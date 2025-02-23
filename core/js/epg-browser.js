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

var Colors = {
    Black: 0,
    Red: 1,
    Green: 2,
    Yellow: 3,
    Blue: 4,
    Magenta: 5,
    Cyan: 6,
    White: 7
};

/* Represents a block of formatted lines.
 */
var FormattedBlock = function (width, fg, bg)
{    
    var that = this;
    var m_width = width;
    var m_lines = [];
    var m_line = 0;
    var m_col = 0;
    var m_defaultFg = fg;
    var m_defaultBg = bg;
    var m_fg = fg;
    var m_bg = bg;

    requireLine(0);

    function requireLine(n)
    {
        while (m_lines.length < n + 1)
        {
            m_lines.push([]);
        }
    }

    /* Moves the cursor to the given position.
     */
    this.moveTo = function (line, col)
    {
        requireLine(line);
        m_line = line;
        m_col = col; 
    };

    this.currentLine = function () { return m_line; };
    this.currentColumn = function () { return m_col; };

    /* Sets the current foreground and background colors.
     */
    this.color = function (fg, bg)
    {
        m_fg = fg;
        m_bg = bg;
    };

    /* Writes the given string to the current cursor position
     * and moves the cursor. If rtl is true, the string is written
     * right-aligned and the cursor moves to the left.
     */
    this.write = function (s, rtl)
    {
        var line = m_line;
        var col = rtl ? m_col - s.length : m_col;

        if (col + s.length <= 0 || col >= m_width)
        {
            return;
        }

        if (col < 0)
        {
            s = s.substr(-col);
            col = 0;
        }
        if (col + s.length >= m_width)
        {
            s = s.substr(0, m_width - col);
        }
        m_lines[line].push([col, s, m_fg, m_bg]);
        m_col = rtl ? col : col + s.length;
    };

    this.writeButton = function (s, rtl)
    {
        var fg = m_fg;
        var bg = m_bg;
        that.color(Colors.White, Colors.Blue);
        that.write(s, rtl);
        that.color(fg, bg);
    };

    /* Writes this block to stdout.
     */
    this.render = function ()
    {
        m_lines.forEach(function (line)
        {
            var pos = 0;
            var s = "";
            s += "\x1b[" + (30 + m_defaultFg) + "m";
            s += "\x1b[" + (40 + m_defaultBg) + "m";

            line.sort(function (a, b)
            {
                return a[0] - b[0];
            })
            .forEach(function (item)
            {
                if (item[0] < pos)
                {
                    return;
                }
                while (pos < item[0])
                {
                    s += " ";
                    ++pos;
                }

                var fg = item[2];
                var bg = item[3];
                if (fg !== m_defaultFg) s += "\x1b[" + (30 + fg) + "m";
                if (bg !== m_defaultBg) s += "\x1b[" + (40 + bg) + "m";
                s += item[1];
                if (fg !== m_defaultFg) s += "\x1b[" + (30 + m_defaultFg) + "m";
                if (bg !== m_defaultBg) s += "\x1b[" + (40 + m_defaultBg) + "m";

                pos += item[1].length;
            });
            for (var c = pos; c < m_width; ++c) s += " ";

            console.log(s + "\x1b[0m");
        });
    };
}

var Timeline = function (start, width, scale)
{
    var m_start = start;
    var m_scale = scale;
    var m_duration = (width - 1) / m_scale;
    var m_width = width;

    function padded(s, length)
    {
        while (s.length < length)
        {
            s += " ";
        }
        return s;
    }

    /* Inserts the given timestamp on the timeline.
     */
    this.insertTimestamp = function (block, timestamp)
    {
        var offset = Math.floor((timestamp - m_start) * m_scale);
        var title = formatTime(new Date(timestamp * 1000));

        if (offset >= m_width)
        {
            return;
        }

        block.moveTo(block.currentLine(), offset);
        block.write("|" + title);
    };

    /* Inserts the given text on the timeline.
     */
    this.insertText = function (block, timestamp, text)
    {
        var offset = Math.floor((timestamp - m_start) * m_scale);

        if (offset >= m_width)
        {
            return;
        }

        block.moveTo(block.currentLine(), offset);
        block.write(text);
    };

    /* Inserts the given marker on the timeline.
     */
    this.insertMarker = function (block, timestamp, duration, marker)
    {
        var offset = Math.floor((timestamp - m_start) * m_scale);
        var length = Math.floor(duration * m_scale);
        var text = formatLine(marker, length);

        if (offset >= m_width)
        {
            return;
        }
        block.moveTo(block.currentLine(), offset);
        block.write(text);
    };

    /* Inserts the given event on the timeline.
     */
    this.insertEvent = function (block, event)
    {
        var offset = Math.floor((event.start - m_start) * m_scale);
        var length = Math.floor(event.duration * m_scale);

        var title = event.short.name.substr(0, length - 1).replace(/\0/g, " ");
        var subtitle = event.short.text.substr(0, length - 1).replace(/\0/g, " ");

        if (offset >= m_width)
        {
            return;
        }

        if (! event.scrambled)
        {
            block.moveTo(block.currentLine(), offset);
            block.write(padded("|" + title, length));
            block.moveTo(block.currentLine() + 1, offset);
            block.write(padded("|" + subtitle, length));
        }
        else
        {
            block.moveTo(block.currentLine(), offset);
            block.write(padded("|" + title, length));
            block.moveTo(block.currentLine() + 1, offset);
            block.write(padded("|" + subtitle, length));
        }
        block.moveTo(block.currentLine() - 1, 0);
    };
};


var EpgDisplay = function (pdvr)
{
    // display mode: epg | info
    var m_displayMode = "epg";

    var m_pdvr = pdvr;
    var m_channelsMap = { };
    var m_epg = { };

    var m_filteredEpg = { };
    var m_filterTerm = "";
    
    var m_services = [];
    var m_recordings = [];

    var m_now = 0;
    var m_startTime = 0;

    var m_currentSelectionIndex = 0;
    var m_selectionOffset = 0;

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
        m_epg = JSON.parse(modChildProcess.execSync(m_pdvr + " get-epg", { maxBuffer: 1024 * 1024 * 1024 })).services || { };
        m_services = Object.keys(m_epg).filter(function (serviceId)
        {
            return m_epg[serviceId] &&
                   m_channelsMap[serviceId] &&
                   Object.keys(m_epg[serviceId]).length > 0;
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

    /* Returns the possibly filtered list of service IDs.
     */
    function services()
    {
        if (Object.keys(m_filteredEpg).length > 0)
        {
            return Object.keys(m_filteredEpg).sort(function (a, b)
            {
                return m_channelsMap[a] < m_channelsMap[b] ? -1 : 1;
            });
        }
        else
        {
            return m_services;
        }
    }

    /* Returns the possibly filtered list of event IDs in the given service.
     */
    function events(serviceId)
    {
        function cmp(a, b)
        {
            return m_epg[serviceId][a].start - m_epg[serviceId][b].start;
        }

        function timeFilter(eventId)
        {
            var evObj = m_epg[serviceId][eventId];
            return evObj.start + evObj.duration > m_now;
        }

        if (Object.keys(m_filteredEpg).length > 0 && m_filteredEpg[serviceId])
        {
            return Object.keys(m_filteredEpg[serviceId])
            .filter(timeFilter)
            .sort(cmp);
        }
        else if (m_epg[serviceId])
        {
            return Object.keys(m_epg[serviceId])
            .filter(timeFilter)
            .sort(cmp);
        }
        else
        {
            return [];
        }
    }

    /* Retrieves the event of the possibly filtered given service at the
     * given time.
     * Returns null if no event was found.
     */
    function eventAt(serviceId, atTime)
    {
        var evs = events(serviceId).filter(function (eventId)
        {
            var evObj = m_epg[serviceId][eventId];
            return evObj.start <= atTime &&
                   evObj.start + evObj.duration > atTime;
        });
        return evs ? m_epg[serviceId][evs[0]]
                   : null;
    }

    /* Skips to the nearest event.
     */
    function skipToNearestEvent()
    {
        function distanceTo(eventId)
        {
            var evObj = m_epg[svcId][eventId];
            return Math.min(Math.abs(evObj.start - m_startTime),
                            Math.abs(evObj.start + evObj.duration - m_startTime));
        }

        var svcId = services()[m_currentSelectionIndex];
        var evs = events(svcId).sort(function (a, b)
        {
            return distanceTo(a) - distanceTo(b);
        });
        if (evs)
        {
            var nearest = m_epg[svcId][evs[0]];
            if (nearest)
            {
                m_startTime = nearest.start;
            }
        }        
    }

    /* Schedules the recording of the given event.
     */
    function scheduleEvent(serviceId, ev)
    {
        function quote(s)
        {
            return "\"" +
                   s.replace(/\"/g, "\\\"") +
                   "\"";
        }

        var date = new Date(ev.start * 1000);
        var time = date.getFullYear() + "/" +
                   (date.getMonth() + 1) + "/" +
                   date.getDate() + " " +
                   date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();

        try
        {
            var name = ev.short.name;
            if (ev.short.text !== "")
            {
                name += " (" + ev.short.text + ")";
            }
            modChildProcess.execSync(m_pdvr + " record \"" +
                                    time + "\" " + ev.duration + " " +
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
        m_now = toTimestamp(new Date());

        if (m_startTime < m_now) m_startTime = m_now;

        if (m_currentSelectionIndex < 0)
        {
            m_currentSelectionIndex = 0;
        }
        else if (services().length > 0 && m_currentSelectionIndex > services().length - 1)
        {
            m_currentSelectionIndex = services().length - 1;
        }

        if (m_currentSelectionIndex < m_selectionOffset)
        {
            m_selectionOffset = m_currentSelectionIndex;
        }
        else if (m_currentSelectionIndex > m_selectionOffset + m_rows - 1)
        {
            m_selectionOffset = m_currentSelectionIndex - m_rows + 1;
        }

        m_currentEvent = eventAt(services()[m_currentSelectionIndex], m_startTime);
        if (! m_currentEvent)
        {
            skipToNearestEvent();
            m_currentEvent = eventAt(services()[m_currentSelectionIndex], m_startTime);
        }

        m_rows = Math.floor((process.stdout.rows - 8) / 4);
        render();
    }

    /* Renders the current display.
     */
    function render()
    {
        modReadline.cursorTo(process.stdout, 0, 0);

        switch (m_displayMode)
        {
        case "epg":
            renderEpg();
            break;
        case "info":
            renderInfo();
            break;
        }

        modReadline.clearScreenDown(process.stdout);
    }

    /* Renders the given channel, highlighting the given event if any.
     */
    function renderChannel(serviceId, currentEvent)
    {   
        var cols = process.stdout.columns;
        var visibleDuration = cols / (m_colsPerHour / 3600);

        var blk = new FormattedBlock(cols, Colors.White, Colors.Black);
        var eventsTimeline = new Timeline(m_startTime - 1800, cols, m_colsPerHour / 3600);
    
        // render the events
        events(serviceId).forEach(function (eventId)
        {
            var evObj = m_epg[serviceId][eventId];
    
            if (currentEvent && evObj.eventId === currentEvent.eventId)
            {
                blk.color(Colors.White, Colors.Red);
            }
            else
            {
                blk.color(Colors.White, Colors.Blue);
            }
    
            if (evObj.start + evObj.duration > m_startTime - 1800 &&
                evObj.start < m_startTime + visibleDuration)
            {
                eventsTimeline.insertEvent(blk, evObj);
            }
        });
    
        // render recording markers
        blk.moveTo(blk.currentLine() + 2);
        blk.color(Colors.White, Colors.Yellow);
        m_recordings.filter(function (rec)
        {
            return rec.channel === m_channelsMap[serviceId];
        })
        .forEach(function (rec)
        {
            eventsTimeline.insertMarker(blk, rec.start, rec.duration, " ");
        });

        blk.render();
    }

    /* Renders the EPG display.
     */
    function renderEpg()
    {
        var cols = process.stdout.columns;
    
        // render header
        var blk = new FormattedBlock(cols, Colors.Black, Colors.White);
        blk.writeButton("[<]");
        blk.write(" " + new Date(m_startTime * 1000).toDateString() + " ");
        blk.writeButton("[>]");
        blk.write("   ");
        blk.writeButton("[S] Search");
        if (m_filterTerm !== "")
        {
            blk.write(" [" + m_filterTerm + "] ");
            blk.writeButton("[X]");
            blk.write("");
        }
        blk.moveTo(0, cols);
        blk.writeButton("[Esc] Quit", true);
        blk.render();
    
        var currentServiceId = services()[m_currentSelectionIndex];
        var currentChannelName = m_channelsMap[currentServiceId];
    
        // render event info
        blk = new FormattedBlock(cols, Colors.Black, Colors.White);
        blk.moveTo(1, 0);
        blk.color(Colors.Blue, Colors.White);
        blk.write(currentChannelName + " ");
        blk.color(Colors.Black, Colors.White);

        if (m_currentEvent)
        {
            blk.write(formatTime(new Date(m_currentEvent.start * 1000)) + " - " +
                      formatTime(new Date((m_currentEvent.start + m_currentEvent.duration) * 1000)));
            blk.moveTo(1, cols);
            blk.writeButton("[I] Info", true);
            blk.write("   ", true);
            blk.writeButton("[R] Record", true);
            
            var info = m_currentEvent.short.name.replace(/\0/g, " ");
            if (m_currentEvent.short.text !== "")
            {
                info += " (" + m_currentEvent.short.text.replace(/\0/g, " ") + ")";
            }
            blk.moveTo(2, 0);
            blk.write(info);
        }
        else
        {
            blk.moveTo(2, 0);
            blk.write("-- no information available --");
        }
        blk.moveTo(3, 0);
        blk.render();
    
        // render hours and recordings timeline
        blk = new FormattedBlock(cols, Colors.White, Colors.Black);
        var timeLine = new Timeline(m_startTime - 1800, cols, m_colsPerHour / 3600);
        for (var t = m_startTime - (m_startTime % 3600); t < m_startTime + cols / (m_colsPerHour / 3600); t += 1800)
        {
            timeLine.insertTimestamp(blk, t);
        }
        blk.moveTo(1, 0);
        blk.color(Colors.Black, Colors.Yellow)
        m_recordings.forEach(function (rec)
        {
            timeLine.insertMarker(blk, rec.start, rec.duration, " ");
        });
        blk.color(Colors.White, Colors.Black);
        timeLine.insertText(blk, toTimestamp(new Date()), "^")
        blk.render();
    
        // render channels
        var serviceIds = services();
        for (var i = 0; i < m_rows && i < serviceIds.length - m_selectionOffset; ++i)
        {
            var serviceId = serviceIds[m_selectionOffset + i];
            var channelName = m_channelsMap[serviceId];

            var fg = Colors.White;
            var bg = serviceId === currentServiceId ? Colors.Red
                                                    : Colors.Black;

            blk = new FormattedBlock(cols, fg, bg);
            blk.write(channelName || "<no name>");
            blk.render();
            if (m_selectionOffset + i === m_currentSelectionIndex)
            {
                renderChannel(serviceId, m_currentEvent);
            }
            else
            {
                renderChannel(serviceId, null);
            }
        }
    }

    /* Renders the info display.
     */
    function renderInfo()
    {
        var cols = process.stdout.columns;

        modReadline.clearScreenDown(process.stdout);
    
        // header
        var part1 = "[Esc] Back";
        var part2 = "[R] Record";
        console.log(part1 + formatLine(" ", cols - (part1.length + part2.length)) + part2);
    
        console.log(formatLine("_", cols));
        
        var currentServiceId = services()[m_currentSelectionIndex];
        var currentChannelName = m_channelsMap[currentServiceId];
    
        // event info
        if (m_currentEvent)
        {
            console.log(currentChannelName + " " +
                        formatTime(new Date(m_currentEvent.start * 1000)) + " - " +
                        formatTime(new Date((m_currentEvent.start + m_currentEvent.duration) * 1000)));
            var info = m_currentEvent.short.name.replace(/\0/g, " ");
            if (m_currentEvent.short.text !== "")
            {
                info += " (" + m_currentEvent.short.text.replace(/\0/g, " ") + ")";
            }
            console.log(info.substr(0, cols));
            console.log(formatLine("_", cols));
            console.log("");
            console.log(m_currentEvent.extended.text.replace(/\0/g, "\n\n"));
        }
        else
        {
            console.log(currentChannelName);
            console.log("-- no information available --");
            console.log(formatLine("_", cols));
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

    /* Zooms in.
     */
    this.zoomIn = function ()
    {
        m_colsPerHour += 5;
        update();
    };
    
    /* Zooms out.
    */
   this.zoomOut = function ()
   {
        m_colsPerHour = Math.max(12, m_colsPerHour - 5);
        update();
    };

    /* Skips to the previous channel.
     */
    this.previousChannel = function ()
    {
        --m_currentSelectionIndex;
        update();
    };

    /* Skips to the next channel.
     */
    this.nextChannel = function ()
    {
        ++m_currentSelectionIndex;
        update();
    };

    /* Skips to the previous show.
     */
    this.previousShow = function ()
    {
        if (m_currentEvent)
        {
            var svcId = services()[m_currentSelectionIndex];
            var evs = events(svcId);
            var idx = evs.indexOf("" + m_currentEvent.eventId);
            if (idx > 0)
            {
                m_startTime = m_epg[svcId][evs[idx - 1]].start;
                update();
            }
        }
    };

    /* Skips to the next show.
     */
    this.nextShow = function ()
    {
        if (m_currentEvent)
        {
            var svcId = services()[m_currentSelectionIndex];
            var evs = events(svcId);
            var idx = evs.indexOf("" + m_currentEvent.eventId);
            if (idx >= 0 && idx < evs.length - 1)
            {
                m_startTime = m_epg[svcId][evs[idx + 1]].start;
                update();
            }
        }
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
            scheduleEvent(services()[m_currentSelectionIndex], m_currentEvent);
            loadRecordings();
            update();
        }
    };

    /* Filters the EPG for the given search term.
     */
    this.setFilter = function (term)
    {
        m_filteredEpg = { };
        m_filterTerm = term;

        m_currentSelectionIndex = 0;
        m_startTime = m_now;
        
        if (term === "")
        {
            update();
            return;
        }
        
        var re = new RegExp(term, "i");
        for (var service in m_epg)
        {
            for (var event in m_epg[service])
            {
                var evObj = m_epg[service][event];
                var name = (evObj.short || { }).name || "";
                var text = (evObj.short || { }).text || "";
                var info = (evObj.extended || { }).text || "";

                if (evObj.start + evObj.duration < m_now)
                {
                    continue;
                }

                if (name.match(re) || text.match(re) || info.match(re))
                {
                    if (! m_filteredEpg[service])
                    {
                        m_filteredEpg[service] = { };
                    }
                    m_filteredEpg[service][event] = evObj;
                }
            }
        }

        update();
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

var pdvr = process.argv[2];
if (! pdvr || ! modFs.existsSync(pdvr))
{
    console.log("Usage: node epg-browser.js <path to pdvr>");
    process.exit(1);
}

var epgDisplay = new EpgDisplay(pdvr);
var isPrompt = false;
rl.input.on("keypress", function (char, key)
{
    if (isPrompt)
    {
        return;
    }

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
            epgDisplay.zoomIn();
        }
        else if (char === "-")
        {
            epgDisplay.zoomOut();
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
            modReadline.clearLine(process.stdout, -1);
            rl.clearLine();
            modReadline.cursorTo(process.stdout, 0, 0);
            modReadline.clearScreenDown(process.stdout);
            rl.question("Search for: ", function (term)
            {
                isPrompt = false;
                epgDisplay.setFilter(term);
            });
        }
        else if (key.name === "x")
        {
            epgDisplay.setFilter("");
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
});
