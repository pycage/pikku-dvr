"use strict";

const modChildProcess = require("child_process"),
      modPath = require("path"),
      modUrl = require("url");

exports.init = function (config)
{
    require.main.exports.registerService("pikku-dvr", new Service(config));
    require.main.exports.registerResource("pikku-dvr", modPath.join(__dirname, "pikku-dvr"));

    require.main.exports.registerShellExtension("/::res/pikku-dvr/index.js");
};


function Service(config)
{
    var m_pdvr = modPath.join(__dirname, "..", "pdvr");
    var m_epg = null;
    var m_timestamp = 0;

    function send(response, data, callback)
    {
        response.setHeader("Content-Length", Buffer.byteLength(data, "utf-8"));
        response.writeHeadLogged(200, "OK");
        response.write(data);
        response.end();
    }

    /* Loads the list of channels.
     */
    function loadChannels()
    {
        var channelsMap = { };
        var channelsConf = modChildProcess.execSync(m_pdvr + " get-channels");
        channelsConf.toString("utf-8").split("\n").forEach(function (line)
        {
            var parts = line.split(":");
            var serviceId = parts[parts.length - 1];
            var channelName = parts[0];
            channelsMap[serviceId] = channelName;
        });

        return channelsMap;
    }

    /* Loads the EPG.
     */
    function loadEpg()
    {
        var epg = { };
        var data = modChildProcess.execSync(m_pdvr + " get-epg");
        epg = JSON.parse(data);
        return epg;
    }

    /* Loads the currently scheduled recordings.
     */
    function loadRecordings()
    {
        function getServiceId(channel)
        {
            for (var serviceId in channelsMap)
            {
                if (channelsMap[serviceId] === channel)
                {
                    return serviceId;
                }
            }
            return "0";
        }

        var channelsMap = loadChannels();
        var recordings = [];
        var recs = modChildProcess.execSync(m_pdvr + " get-recordings");
        recs.toString("utf-8").split("\n").forEach(function (line)
        {
            var parts = line.split("|");
            if (parts.length >= 4)
            {
                recordings.push({
                    start: Number.parseInt(parts[0]),
                    duration: Number.parseInt(parts[1]),
                    serviceId: getServiceId(parts[2]),
                    name: parts[3]
                });
            }
        });
        return recordings;
    }

    /* Schedules the recording of the given event.
     */
    function record(serviceId, start, duration, name, callback)
    {
        function quote(s)
        {
            return "\"" +
                   s.replace(/\"/g, "\\\"") +
                   "\"";
        }

        var date = new Date(start * 1000);
        var time = date.getFullYear() + "/" +
                   (date.getMonth() + 1) + "/" +
                   date.getDate() + " " +
                   date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();

        try
        {
            var channelsMap = loadChannels();
            modChildProcess.execSync(m_pdvr + " record \"" +
                                     time + "\" " + duration + " " +
                                     quote(channelsMap[serviceId]) + " " +
                                     quote(name));
            callback(null);
        }
        catch (err)
        {
            console.error(err.status + " " + err.stdout);
            callback(err);
        }
    }

    /* Cancel the recording at the given time.
     */
    function cancel(serviceId, at, callback)
    {
        var toCancel = loadRecordings().filter(function (rec)
        {
            return rec.serviceId === serviceId &&
                   at >= rec.start && at < rec.start + rec.duration;
        })
        .map(function (rec)
        {
            return rec.start;
        });

        toCancel.forEach(function (t)
        {
            modChildProcess.execSync(m_pdvr + " cancel " + t);
        });
        callback(null);
    }

    /* Searches for the given search term and returns a list of 
     * matching events.
     */
    function search(searchTerm, callback)
    {
        if (! m_epg)
        {
            m_epg = loadEpg();
        }

        var now = new Date().getTime() / 1000;
        var re = new RegExp(searchTerm, "i");
        var result = [];
        for (var serviceId in m_epg.services)
        {
            for (var eventId in m_epg.services[serviceId])
            {
                var event = m_epg.services[serviceId][eventId];
                var name = (event.short || { }).name || "";
                var text = (event.short || { }).text || "";
                var info = (event.extended || { }).text || "";

                if (event.start + event.duration < now)
                {
                    continue;
                }

                if (name.match(re) || text.match(re) || info.match(re))
                {
                    result.push({
                        serviceId: serviceId,
                        eventId: eventId,
                        start: event.start,
                        duration: event.duration,
                        name: event.short.name,
                        short: event.short.text
                    });
                }
            }
        }
        callback(result);
    }
    
    this.handleRequest = function (request, response, userContext, shares, callback)
    {
        var now = Date.now();
        if (now > m_timestamp + 12 * 3600 * 1000)
        {
            // force-reload the EPG from time to time
            m_epg = null;
            m_timestamp = now;
        }

        var urlObj = modUrl.parse(request.url, true);
        var uri = urlObj.pathname.substr("/::pikku-dvr".length);

        if (request.method === "GET")
        {
            if (uri === "/channels")
            {
                var channels = loadChannels();
                send(response, JSON.stringify(channels), callback);

            }
            else if (uri === "/epg")
            {
                var serviceId = request.headers["x-pilvini-service"] || "0";
                var begin = Number.parseInt(request.headers["x-pilvini-begin"] || "0");
                var end = Number.parseInt(request.headers["x-pilvini-end"] || "0");

                if (! m_epg)
                {
                    m_epg = loadEpg();
                }

                var events = m_epg.services[serviceId] || { };
                var result = Object.keys(events).filter(function (eventId)
                {
                    var event = events[eventId];
                    return event.start < end && event.start + event.duration >= begin;
                })
                .map(function (eventId)
                {
                    var event = events[eventId];
                    return {
                        eventId: eventId,
                        start: event.start,
                        duration: event.duration,
                        name: event.short.name,
                        short: event.short.text
                    };
                });
                var data = {
                    events: result
                };
                send(response, JSON.stringify(data), callback);
            }
            else if (uri === "/event")
            {
                var serviceId = request.headers["x-pilvini-service"] || "0";
                var eventId = request.headers["x-pilvini-event"] || "0";

                if (! m_epg)
                {
                    m_epg = loadEpg();
                }

                console.log(JSON.stringify(m_epg.services[serviceId][eventId]));
                var event = m_epg.services[serviceId] ? (m_epg.services[serviceId][eventId] || { })
                                             : { };
                send(response, JSON.stringify(event), callback);
            }
            else if (uri === "/recordings")
            {
                var recordings = { recordings: loadRecordings() };
                send(response, JSON.stringify(recordings), callback);
            }
        }
        else if (request.method === "POST")
        {
            if (uri === "/record")
            {
                var json = "";
                request.on("data", function (chunk) { json += chunk; });
                request.on("end", function ()
                {
                    var data = JSON.parse(json);
                    record(data.serviceId, data.start, data.duration, data.name, function (err)
                    {
                        if (err)
                        {
                            response.writeHeadLogged(500, "Internal Server Error");
                        }
                        else
                        {
                            response.writeHeadLogged(201, "Created");
                        }
                        response.end();
                        callback();
                    })
                });
            }
            else if (uri === "/cancel")
            {
                json = "";
                request.on("data", function (chunk) { json += chunk; });
                request.on("end", function ()
                {
                    data = JSON.parse(json);
                    cancel(data.serviceId, data.at, function (err)
                    {
                        if (err)
                        {
                            response.writeHeadLogged(500, "Internal Server Error");
                        }
                        else
                        {
                            response.writeHeadLogged(204, "Canceled");
                        }
                        response.end();
                        callback();
                    });
                });
            }
            else if (uri === "/search")
            {
                json = "";
                request.on("data", function (chunk) { json += chunk; });
                request.on("end", function ()
                {
                    data = JSON.parse(json);
                    search(data.searchTerm, function (result)
                    {
                        send(response, JSON.stringify({ result: result }), callback);
                    });
                });
            }
        }
    };
}