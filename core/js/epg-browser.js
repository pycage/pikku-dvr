"use strict";

const modChildProcess = require("child_process"),
      modFs = require("fs"),
      modReadline = require("readline");

/* Converts a Date object to a Unix timestamp.
 */
function toTimestamp(d)
{
    return Math.floor(d.getTime() / 1000);
}

/* Formats a Date object as HH:MM.
 */
function formatTime(d)
{
    var h = d.getHours();
    var m = d.getMinutes();
    if (h < 10) h = "0" + h;
    if (m < 10) m = "0" + m;
    return h + ":" + m;
}

/* Creates a line of the given length consisting of the given character.
 */
function formatLine(c, length)
{
    var out = "";
    for (var i = 0; i < length; ++i)
    {
        out += c;
    }
    return out;
}

/* Retrieves the event of the given service at the given time.
 * Returns null if no event was found.
 */
function getEventAtTime(epg, serviceId, atTime)
{
    if (! epg[serviceId])
    {
        return null;
    }

    var tables = Object.keys(epg[serviceId]);

    for (var i = 0; i < tables.length; ++i)
    {
        var table = tables[i];
        for (var eventId in epg[serviceId][table])
        {
            var evObj = epg[serviceId][table][eventId];
            if (evObj.start <= atTime && evObj.start + evObj.duration > atTime)
            {
                return evObj;
            }
        }
    }
    return null;
}

var Timeline = function (start, width, scale)
{
    var m_start = start;
    var m_scale = scale;
    var m_duration = (width - 1) / m_scale;
    var m_width = width;

    var m_lines = [];

    function requireLine(n)
    {
        while (m_lines.length < n + 1)
        {
            var line = "";
            for (var i = 0; i < m_width; ++i)
            {
                line += " ";
            }
            m_lines.push(line);
        }
    }

    function writeLine(n, at, s)
    {
        requireLine(n);
        for (var i = 0; i < s.length; ++i)
        {
            if (at + i >= 0 && at + i < m_lines[n].length)
            {
                m_lines[n] = m_lines[n].substr(0, at + i) + s[i] + m_lines[n].substr(at + i + 1);
            }
        }
    }

    /* Inserts the given timestamp on the timeline.
     */
    this.insertTimestamp = function (line, timestamp)
    {
        var offset = Math.floor((timestamp - m_start) * m_scale);
        var title = formatTime(new Date(timestamp * 1000));

        if (offset >= m_width)
        {
            return;
        }

        writeLine(line, offset, "|" + title);
    };

    /* Inserts the given text on the timeline.
     */
    this.insertText = function (line, timestamp, text)
    {
        var offset = Math.floor((timestamp - m_start) * m_scale);

        if (offset >= m_width)
        {
            return;
        }

        writeLine(line, offset, text);
    };

    /* Inserts the given marker on the timeline.
     */
    this.insertMarker = function (line, timestamp, duration, marker)
    {
        var offset = Math.floor((timestamp - m_start) * m_scale);
        var length = Math.floor(duration * m_scale);
        var text = formatLine(marker, length);

        if (offset >= m_width)
        {
            return;
        }
        writeLine(line, offset, text);
    };

    /* Inserts the given event on the timeline.
     */
    this.insertEvent = function (line, event)
    {
        var offset = Math.floor((event.start - m_start) * m_scale);
        var length = Math.floor(event.duration * m_scale);

        var title = event.short.name.substr(0, length - 1);
        var subtitle = event.short.text.substr(0, length - 1);

        if (offset >= m_width)
        {
            return;
        }

        if (! event.scrambled)
        {
            writeLine(line, offset, "|" + title);
            writeLine(line + 1, offset, "|" + subtitle);
        }
        else
        {
            writeLine(line, offset, "|" + title);
            writeLine(line + 1, offset, "|" + subtitle);
        }
    };

    this.render = function ()
    {
        m_lines.forEach(function (line) { console.log(line); });
    };
};


var EpgDisplay = function (pdvr)
{
    // display mode: epg | info | search
    var m_displayMode = "epg";

    var m_pdvr = pdvr;
    var m_channelsMap = { };
    var m_epg = { };
    var m_filteredEpg = { };
    var m_services = [];
    var m_recordings = [];

    var m_now = toTimestamp(new Date());
    var m_startTime = m_now;
    var m_currentServiceIndex = 0;
    var m_serviceOffset = 0;

    var m_currentEvent = null;

    var m_rows = 0;
    var m_colsPerHour = 24;


    loadChannels();
    loadEpg();
    loadRecordings();
    update();


    /* Loads the list of channels.
     */
    function loadChannels()
    {
        console.log("Loading Channels...");
        m_channelsMap = { };
        var channelsConf = modChildProcess.execSync(m_pdvr + " get-channels");
        channelsConf.toString("utf-8").split("\n").forEach(function (line)
        {
            var parts = line.split(":");
            var serviceId = parts[parts.length - 1];
            var channelName = parts[0];
            m_channelsMap[serviceId] = channelName;
        });
    }

    /* Loads the EPG data.
     */
    function loadEpg()
    {
        console.log("Loading EPG...");
        m_epg = JSON.parse(modChildProcess.execSync(m_pdvr + " get-epg"));
        m_services = Object.keys(m_epg).filter(function (serviceId)
        {
            return m_epg[serviceId] &&
                   m_channelsMap[serviceId] &&
            Object.keys(m_epg[serviceId]).reduce(function (sum, table)
            {
                return sum + Object.keys(m_epg[serviceId][table]).length;
            }, 0) > 0;
        }).sort(function (a, b)
        {
            return m_channelsMap[a].toUpperCase() < m_channelsMap[b].toUpperCase() ? -1 : 1;
        });
    }
    
    /* Loads the currently scheduled recordings.
     */
    function loadRecordings()
    {
        m_recordings = [];
        var recs = modChildProcess.execSync(m_pdvr + " get-recordings");
        recs.toString("utf-8").split("\n").forEach(function (line)
        {
            var parts = line.split("|");
            if (parts.length >= 4)
            {
                m_recordings.push({
                    start: parts[0],
                    duration: parts[1],
                    channel: parts[2],
                    name: parts[3]
                });
            }
        });
    }

    /* Schedules the recording of the given event.
     */
    function scheduleEvent(serviceId, ev)
    {
        function quote(s)
        {
            return "'" +
                s.replace(/'/g, "\\'")
                    .replace(/!/g, "\\!") +
                "'";
        }

        var date = new Date(ev.start * 1000);
        var time = date.getFullYear() + "/" +
                (date.getMonth() + 1) + "/" +
                date.getDate() + " " +
                date.getHours() + ":" + date.getMinutes();

        try
        {
            var name = ev.short.name;
            if (ev.short.text !== "")
            {
                name += " (" + ev.short.text + ")";
            }
            modChildProcess.execSync(m_pdvr + " record '" +
                                    time + "' " + ev.duration + " " +
                                    quote(m_channelsMap[serviceId]) + " " +
                                    quote(name));
        }
        catch (err)
        {
            console.error(err.status + " " + err.stdout);
            process.exit(1);
        }
    }

    /* Updates the display.
     */
    function update()
    {
        if (m_startTime < m_now) m_startTime = m_now;

        if (m_currentServiceIndex < 0)
        {
            m_currentServiceIndex = 0;
        }
        else if (m_currentServiceIndex > m_services.length - 1)
        {
            m_currentServiceIndex = m_services.length - 1;
        }

        if (m_currentServiceIndex < m_serviceOffset)
        {
            m_serviceOffset = m_currentServiceIndex;
        }
        else if (m_currentServiceIndex > m_serviceOffset + m_rows - 1)
        {
            m_serviceOffset = m_currentServiceIndex - m_rows + 1;
        }

        m_currentEvent = getEventAtTime(m_epg, m_services[m_currentServiceIndex], m_startTime);

        m_rows = Math.floor((process.stdout.rows - 10) / 6);
        render();
    }

    /* Renders the current display.
     */
    function render()
    {
        switch (m_displayMode)
        {
        case "epg":
            renderEpg();
            break;
        case "info":
            renderInfo();
            break;
        case "search":
            renderSearch();
            break;
        }
    }

    /* Renders the given channel, highlighting the given event if any.
     */
    function renderChannel(serviceId, currentEvent)
    {
        if (! m_epg[serviceId])
        {
            return;
        }
    
        var eventsTimeline = new Timeline(m_startTime - 1800, process.stdout.columns, m_colsPerHour / 3600);
        
        m_recordings.filter(function (rec)
        {
            return rec.channel === m_channelsMap[serviceId];
        }).forEach(function (rec)
        {
            eventsTimeline.insertMarker(2, rec.start, rec.duration, "#");
        });
    
        var tables = Object.keys(m_epg[serviceId]);
        tables.forEach(function (table)
        {
            var events = m_epg[serviceId][table];
            for (var eventId in events)
            {
                var evObj = events[eventId];
                if (evObj.start + evObj.duration > m_startTime - 1800 &&
                    evObj.start < m_startTime + 72 * 3600)
                {
                    eventsTimeline.insertEvent(0, evObj);
                }
            }
        });
    
        if (currentEvent)
        {
            eventsTimeline.insertMarker(2,
                currentEvent.start,
                currentEvent.duration,
                "^");
        }
        else
        {
            eventsTimeline.insertTimestamp(2, 0);
        }
        eventsTimeline.render();
    }

    /* Renders the EPG display.
     */
    function renderEpg()
    {
        var cols = process.stdout.columns;

        modReadline.cursorTo(process.stdout, 0, 0);
        modReadline.clearScreenDown(process.stdout);
    
        // header
        var part1 = "[<] " +
                    new Date(m_startTime * 1000).toDateString() +
                    " [>]   " +
                   "[C] Goto Channel   [S] Search";
        var part2 = "[Q] Quit";
        console.log(part1 +
                    formatLine(" ", cols - (part1.length + part2.length)) +
                    part2);
    
        console.log(formatLine("_", process.stdout.columns));
        
        var currentServiceId = m_services[m_currentServiceIndex];
        var currentChannelName = m_channelsMap[currentServiceId];
    
        // event info
        if (m_currentEvent)
        {
            part1 = currentChannelName + " " +
                    formatTime(new Date(m_currentEvent.start * 1000)) + " - " +
                    formatTime(new Date((m_currentEvent.start + m_currentEvent.duration) * 1000));
            part2 = "[I] Info   [R] Record";
            console.log(part1 + formatLine(" ", cols - (part1.length + part2.length)) + part2);
            var info = m_currentEvent.short.name;
            if (m_currentEvent.short.text !== "")
            {
                info += " (" + m_currentEvent.short.text + ")";
            }
            console.log(info.substr(0, process.stdout.columns));
        }
        else
        {
            console.log(currentChannelName);
            console.log("-- no information available --");
        }
        console.log(formatLine("_", process.stdout.columns));
    
        // hours timeline
        var timeLine = new Timeline(m_startTime - 1800, process.stdout.columns, m_colsPerHour / 3600);
        for (var t = m_startTime - (m_startTime % 3600); t < m_startTime + process.stdout.columns / (m_colsPerHour / 3600); t += 1800)
        {
            timeLine.insertTimestamp(0, t);
        }
        // recordings timeline
        m_recordings.forEach(function (rec)
        {
            timeLine.insertMarker(1, rec.start, rec.duration, "#");
        });
        timeLine.insertText(1, toTimestamp(new Date()), "^")
        timeLine.render();
        console.log("");
        console.log("");
    
        // channels
        for (var i = 0; i < m_rows && i < m_services.length - m_serviceOffset; ++i)
        {
            var serviceId = m_services[m_serviceOffset + i];
            var channelName = m_channelsMap[serviceId];
            if (serviceId === currentServiceId)
            {
                console.log("[" + channelName + "]");
            }
            else
            {
                console.log(" " + channelName);
            }
            console.log(formatLine("_", process.stdout.columns));
            if (m_serviceOffset + i === m_currentServiceIndex)
            {
                renderChannel(serviceId, m_currentEvent);
            }
            else
            {
                renderChannel(serviceId, null);
            }
            console.log("");
        }
    }

    /* Renders the info display.
     */
    function renderInfo()
    {
        var cols = process.stdout.columns;

        modReadline.cursorTo(process.stdout, 0, 0);
        modReadline.clearScreenDown(process.stdout);
    
        // header
        var part1 = "[Q] Back";
        var part2 = "[R] Record";
        console.log(part1 + formatLine(" ", cols - (part1.length + part2.length)) + part2);
    
        console.log(formatLine("_", process.stdout.columns));
        
        var currentServiceId = m_services[m_currentServiceIndex];
        var currentChannelName = m_channelsMap[currentServiceId];
    
        // event info
        if (m_currentEvent)
        {
            console.log(currentChannelName + " " +
                        formatTime(new Date(m_currentEvent.start * 1000)) + " - " +
                        formatTime(new Date((m_currentEvent.start + m_currentEvent.duration) * 1000)));
            var info = m_currentEvent.short.name;
            if (m_currentEvent.short.text !== "")
            {
                info += " (" + m_currentEvent.short.text + ")";
            }
            console.log(info.substr(0, process.stdout.columns));
            console.log(formatLine("_", process.stdout.columns));
            console.log("");
            console.log(m_currentEvent.extended.text);
        }
        else
        {
            console.log(currentChannelName);
            console.log("-- no information available --");
            console.log(formatLine("_", process.stdout.columns));
        }
    }

    function renderSearch()
    {
        var cols = process.stdout.columns;

        modReadline.cursorTo(process.stdout, 0, 0);
        modReadline.clearScreenDown(process.stdout);
    
        // header
        console.log("[Esc] Back");
        console.log(formatLine("_", process.stdout.columns));
        
        for (var service in m_filteredEpg)
        {
            var channelName = m_channelsMap[service];

            for (var table in m_filteredEpg[service])
            {
                for (var event in m_filteredEpg[service][table])
                {
                    var evObj = m_filteredEpg[service][table][event];
                    
                    console.log(channelName + " " +
                    formatTime(new Date(evObj.start * 1000)) + " - " +
                    formatTime(new Date((evObj.start + evObj.duration) * 1000)));
                    var info = evObj.short.name;
                    if (evObj.short.text !== "")
                    {
                        info += " (" + evObj.short.text + ")";
                    }
                    console.log(info.substr(0, process.stdout.columns));
                    console.log("");
                    //console.log(evObj.extended.text);
                    //console.log("");
                }
            }
        }
    }

    /* Changes the display mode.
     */
    this.setDisplayMode = function (mode)
    {
        m_displayMode = mode;
        update();
    };

    /* Returns the current display mode.
     */
    this.displayMode = function ()
    {
        return m_displayMode;
    };

    /* Skips to the previous channel.
     */
    this.previousChannel = function ()
    {
        --m_currentServiceIndex;
        update();
    };

    /* Skips to the next channel.
     */
    this.nextChannel = function ()
    {
        ++m_currentServiceIndex;
        update();
    };

    /* Skips to the previous show.
     */
    this.previousShow = function ()
    {
        if (m_currentEvent)
        {
            var evBefore = getEventAtTime(m_epg, m_services[m_currentServiceIndex],
                                          m_currentEvent.start - 1);
            if (evBefore)
            {
                m_startTime = evBefore.start;
            }
            else
            {
                m_startTime -= 600;
            }
        }
        else
        {
            m_startTime -= 600;
        }
        update();
    };

    /* Skips to the next show.
     */
    this.nextShow = function ()
    {
        if (m_currentEvent)
        {
            var nextEv = getEventAtTime(m_epg, m_services[m_currentServiceIndex],
                                        m_currentEvent.start + m_currentEvent.duration + 1);
            if (nextEv)
            {
                m_startTime = nextEv.start;
            }
            else
            {
                m_startTime += 600;
            }
        }
        else
        {
            m_startTime += 600;
        }
        update();
    };

    /* Skips to the previous day.
     */
    this.previousDay = function ()
    {
        m_startTime -= 3600 * 24;
        update();
    };

    /* Skips to the next day.
     */
    this.nextDay = function ()
    {
        m_startTime += 3600 * 24;
        update();
    };

    /* Records the currently selected show.
     */
    this.recordShow = function ()
    {
        if (m_currentEvent)
        {
            scheduleEvent(m_services[m_currentServiceIndex], m_currentEvent);
            loadRecordings();
            update();
        }
    };

    /* Filters the EPG for the given search term.
     */
    this.filter = function (term)
    {
        var re = new RegExp(term, "i");

        m_filteredEpg = { };
        for (var service in m_epg)
        {
            for (var table in m_epg[service])
            {
                for (var event in m_epg[service][table])
                {
                    var evObj = m_epg[service][table][event];
                    var name = (evObj.short || { }).name || "";
                    var text = (evObj.short || { }).text || "";
                    var info = (evObj.extended || { }).text || "";

                    if (name.match(re) || text.match(re) || info.match(re))
                    {
                        if (! m_filteredEpg[service])
                        {
                            m_filteredEpg[service] = { };
                        }
                        if (! m_filteredEpg[service][table])
                        {
                            m_filteredEpg[service][table] = { };
                        }
                        m_filteredEpg[service][table][event] = evObj;
                    }
                }
            }
        }
    };
};



if (! process.stdin.isTTY)
{
    console.log("Error: Requires a TTY");
    process.exit(1);
}

const rl = modReadline.createInterface({
    input: process.stdin,
    output: process.stdout
});
/*
rl.on("SIGINT", function ()
{
    process.exit(0);
});
*/

var pdvr = process.argv[2];
if (! pdvr || ! modFs.existsSync(pdvr))
{
    console.log("Usage: node epg-browser.js <path to pdvr>");
    process.exit(1);
}

var epgDisplay = new EpgDisplay(pdvr);
//modReadline.emitKeypressEvents(process.stdin);
//process.stdin.setRawMode(true);
var isPrompt = false;
rl.input.on("keypress", function (char, key)
{
    if (isPrompt)
    {
        return;
    }

    //modReadline.clearLine(rl.input, -1);

    if (epgDisplay.displayMode() === "epg")
    {
        if (key.name === "up")
        {
            epgDisplay.previousChannel();
        }
        else if (key.name === "down")
        {
            epgDisplay.nextChannel();
        }
        else if (key.name === "left")
        {
            epgDisplay.previousShow();
        }
        else if (key.name === "right")
        {
            epgDisplay.nextShow();
        }
        else if (char === "<")
        {
            epgDisplay.previousDay();
        }
        else if (char === ">")
        {
            epgDisplay.nextDay();
        }
        else if (char === "+")
        {
            //colsPerHour += 5;
        }
        else if (char === "-")
        {
            //colsPerHour = Math.max(12, colsPerHour - 1);
        }
        else if (key.name === "i")
        {
            epgDisplay.setDisplayMode("info");
        }
        else if (key.name === "r")
        {
            epgDisplay.recordShow();
        }
        else if (key.name === "s")
        {
            isPrompt = true;
            rl.question("Search for: ", function (term)
            {
                isPrompt = false;
                epgDisplay.filter(term);
                epgDisplay.setDisplayMode("search");
            });
        }
        else if (key.name === "escape" || key.name === "q")
        {
            process.exit(0);
        }
    }
    else if (epgDisplay.displayMode() === "info")
    {
        if (key.name === "r")
        {
            epgDisplay.recordShow();
        }
        else if (key.name === "escape" || key.name === "q")
        {
            epgDisplay.setDisplayMode("epg");
        }
    }
    else if (epgDisplay.displayMode() === "search")
    {
        if (key.name === "escape")
        {
            epgDisplay.setDisplayMode("epg");
        }
    }
});
