"use strict";

const mods = [
    "shellfish/low",
    "shellfish/mid",
    "shellfish/high",
    "shell/files",
    "shell/storage"
];

require(mods, function (low, mid, high, files, st)
{
    var storage = st.storage;
    var m_channels = high.binding(null);
    var m_services = high.binding([]);
    var m_recordings = high.binding([]);
    var m_scrollPosition = high.binding(0);

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

    function formatDuration(s)
    {
        var t = s;
        var secs = Math.floor(t) % 60;
        t /= 60;
        var minutes = Math.floor(t) % 60;
        t /= 60;
        var hours = Math.floor(t);

        var h = hours.toFixed(0);
        var m = minutes.toFixed(0);
        var s = secs.toFixed(0);

        if (h.length === 1) { h = "0" + h; }
        if (m.length === 1) { m = "0" + m; }
        if (s.length === 1) { s = "0" + s; }

        return (hours > 0 ? h + ":" : "") + m + ":" + s;
    }

    /* Returns if the given event is scheduled.
     */
    function scheduled(serviceId, begin, end)
    {
        var recs = m_recordings.value();
        var covered = false;
        var full = false;
        var conflict = false;
        for (var i = 0; i < recs.length; ++i)
        {
            var rec = recs[i];
            var recStart = Number.parseInt(rec.start);
            var recDuration = Number.parseInt(rec.duration);

            if (rec.serviceId !== serviceId && begin < (recStart + recDuration) && end > recStart)
            {
                conflict = true;
            }
            if (rec.serviceId === serviceId && begin >= recStart && end <= (recStart + recDuration))
            {
                covered = true;
                full = true;
            }
            else if (rec.serviceId === serviceId && begin < (recStart + recDuration) && end > recStart)
            {
                covered = true;
            }
        }
        return conflict ? "conflict"
                           : full ? "full" 
                                  : covered ? "partial"
                                            : "no";
    }

    /* Element representing a timeline.
     */
    function Timeline()
    {
        mid.defineProperties(this, {
            begin: { set: setBegin, get: begin },
            end: { set: setEnd, get: end },
            recordings: { set: setRecordings, get: recordings },
            scale: { set: setScale, get: scale },
            onMoved: { set: setOnMoved, get: onMoved },
            onClicked: { set: setOnClicked, get: onClicked }
        });

        var m_begin = 0;
        var m_end = 0;
        var m_recordings = [];
        var m_scale = 1;
        var m_onMoved = null;
        var m_onClicked = null;

        var m_isDragging = false;

        var m_item = $(
            low.tag("div")
            .style("position", "fixed")
            .style("top", "3rem")
            .style("width", "100%")
            .style("height", "3rem")
            .style("background-color", "var(--color-content-background)")
            .style("color", "var(--primary-color)")
            .style("white-space", "nowrap")
            .style("overflow-x", "auto")
            .style("overflow-y", "hidden")
            .content(
                low.tag("div")
            )
            .content(
                low.tag("div")
            )
            .html()
        );

        m_item.scroll(function ()
        {
            if (m_onMoved)
            {
                var begin = m_begin + (m_item.scrollLeft() / 200) * 1800;
                var end = begin + (m_item.width()) / 200 * 1800;
                m_onMoved(begin, end);
            }
        });

        m_item.on("mousedown", function (event)
        {
            m_isDragging = true;
            this.position = m_item.scrollLeft();
            this.offset = event.offsetX;
        });
        m_item.on("mousemove", function (event)
        {
            if (m_isDragging)
            {
                var pos = event.offsetX;
                var diff = this.offset - pos;
                m_item.scrollLeft(this.position + diff);
            }
        });
        m_item.on("mouseup", function (event)
        {
            m_isDragging = false;
        });
        m_item.on("mouseleave", function (event)
        {
            m_isDragging = false;
        });

        m_item.on("touchstart", function (event)
        {
            event.stopPropagation();
        });


        function setBegin(begin)
        {
            m_begin = begin;
            update();
        }

        function begin()
        {
            return m_begin;
        }

        function setEnd(end)
        {
            m_end = end;
            update();
        }

        function end()
        {
            return m_end;
        }

        function setRecordings(r)
        {
            m_recordings = r;
            update();
        }

        function recordings()
        {
            return m_recordings;
        }

        function setScale(scale)
        {
            m_scale = scale;
            update();
        }

        function scale()
        {
            return m_scale;
        }

        function setOnMoved(cb)
        {
            m_onMoved = cb;
        }

        function onMoved()
        {
            return m_onMoved;
        }

        function setOnClicked(cb)
        {
            m_onClicked = cb;
        }

        function onClicked()
        {
            return m_onClicked;
        }

        function update()
        {
            m_item.find("> div:nth-child(1)").html("");
            m_recordings.forEach(function (rec)
            {
                var pos = (rec.start - m_begin) * 200 / 1800;
                var width = rec.duration * 200 / 1800;

                var marker = $(
                    low.tag("div")
                    .style("position", "absolute")
                    .style("background-color", "var(--color-highlight-background)")
                    .style("top", "1rem")
                    .style("left", pos + "px")
                    .style("bottom", "0")
                    .style("width", width + "px")
                    .style("overflow", "hidden")
                    .content(
                        low.tag("h2").content(rec.name)
                    )
                    .html()
                );

                marker.on("click", function ()
                {
                    if (m_onClicked)
                    {
                        m_onClicked(rec.serviceId, rec.start);
                    }
                });

                m_item.find("> div:nth-child(1)").append(marker);
            });

            m_item.find("> div:nth-child(2)").html("");
            var begin = m_begin - (m_begin % 1800);
            for (var i = begin; i < m_end; i += 1800)
            {
                var pos = (i - m_begin) * 200 / 1800;
                var label = formatTime(new Date(i * 1000));

                var tick = $(
                    low.tag("div")
                    .style("position", "absolute")
                    .style("left", pos + "px")
                    .style("width", 200 + "px")
                    .style("height", "1rem")
                    .style("font-size", "80%")
                    .style("border-left", "solid 2px var(--color-primary)")
                    .style("padding-left", "0.25em")
                    .style("line-height", "1rem")
                    .style("overflow", "hidden")
                    .style("pointer-events", "none")
                    .content(
                        label
                    )
                    .html()
                );
                m_item.find("> div:nth-child(2)").append(tick);
            }
        }

        this.get = function ()
        {
            return m_item;
        };

        this.update = function ()
        {
            if (m_onMoved)
            {
                var begin = m_begin + (m_item.scrollLeft() / 200) * 1800;
                var end = begin + (m_item.width()) / 200 * 1800;
                m_onMoved(begin, end);
            }
        };

        this.scrollTo = function (time)
        {
            var pos = (time - m_begin) * 200 / 1800;
            m_item.scrollLeft(pos);
        };
    }

    /* Element representing a channel.
     */
    function ChannelItem()
    {    
        mid.defineProperties(this, {
            title: { set: setTitle, get: title },
            serviceId: { set: setServiceId, get: serviceId },
            begin: { set: setBegin, get: begin },
            end: { set: setEnd, get: end },
            scale: { set: setScale, get: scale },
            active: { set: setActive, get: active },
            onClicked: { set: setOnClicked, get: onClicked }
        });

        var m_title = "";
        var m_serviceId = 0;
        var m_begin = 0;
        var m_end = 0;
        var m_scale = 1;
        var m_isActive = false;
        var m_onClicked = null;

        var m_cachedEvents = [];
        var m_cachedRanges = [];

        var m_item = $(
            low.tag("li")
            .style("background-color", "var(--color-content-background)")
            .style("height", "5rem")
            .style("overflow", "hidden")
            .content(
                low.tag("h1")
            )
            .content(
                low.tag("div")
                .style("position", "absolute")
                .style("top", "1.5rem")
                .style("left", "0")
                .style("right", "0")
                .style("bottom", "0")
            )
            .html()
        );


        function setTitle(title)
        {
            m_title = title;
            m_item.find("> h1").html(low.escapeHtml(title) + " ");
        }

        function title()
        {
            return m_title;
        }

        function setServiceId(serviceId)
        {
            m_serviceId = serviceId;
        }

        function serviceId()
        {
            return m_serviceId;
        }

        function setBegin(begin)
        {
            m_begin = begin;
            if (m_isActive)
            {
                update();
            }
        }

        function begin()
        {
            return m_begin;
        }

        function setEnd(end)
        {
            m_end = end;
        }

        function end()
        {
            return m_end;
        }

        function setScale(scale)
        {
            m_scale = scale;
            if (m_isActive)
            {
                update();
            }
        }

        function scale()
        {
            return m_scale;
        }

        function setActive(v)
        {
            var wasActive = m_isActive;
            m_isActive = v;
            if (v && ! wasActive)
            {
                update();
            }
            else if (! v && wasActive)
            {
                m_item.find("> div").html("");
                m_cachedEvents = [];
                m_cachedRanges = [];
            }
        }

        function active()
        {
            return m_isActive;
        }

        function setOnClicked(cb)
        {
            m_onClicked = cb;
        }

        function onClicked()
        {
            return m_onClicked;
        }

        function cacheEvents(begin, end, events)
        {
            // merge events
            var newEvents = events;
            m_cachedEvents.forEach(function (cachedEvent)
            {
                var ev = events.find(function (event)
                {
                    return event.eventId === cachedEvent.eventId;
                });
                if (! ev)
                {
                    newEvents.push(cachedEvent);
                }
            });
            m_cachedEvents = newEvents;
          
            // merge ranges
            m_cachedRanges.push([begin, end]);

            m_cachedRanges.sort(function (a, b)
            {
                return a[0] - b[0];
            });

            var ranges = [];
            for (var i = 0; i < m_cachedRanges.length; ++i)
            {
                var lastIdx = ranges.length - 1;
                if (lastIdx === -1)
                {
                    ranges.push(m_cachedRanges[i]);
                }
                else if (m_cachedRanges[i][0] <= ranges[lastIdx][1])
                {
                    ranges[lastIdx][1] = Math.max(m_cachedRanges[i][1], ranges[lastIdx][1]);
                }
                else
                {
                    ranges.push(m_cachedRanges[i]);
                }
            }
            m_cachedRanges = ranges;
        }

        function update()
        {
            var range = m_cachedRanges.find(function (r)
            {
                return m_begin >= r[0] && m_end <= r[1];
            });

            if (range)
            {
                // all in cache
                render(m_cachedEvents.filter(function (event)
                {
                    return event.start < m_end && event.start + event.duration >= m_begin;
                }));
                return;
            }

            var begin = m_begin;
            var end = m_end;
            setTimeout(function ()
            {
                if (m_begin !== begin || m_end !== end)
                {
                    return;
                }

                var busyIndicator = $(
                    low.tag("span").class("sh-busy-indicator")
                    .html()
                );
                m_item.find("> h1").append(busyIndicator);
                m_item.find("> div").css("visibility", "hidden");
    
                console.log("fetch from server: " + m_begin + " - " + m_end);
                $.ajax({
                    type: "GET",
                    url: "/::pikku-dvr/epg",
                    dataType: "json",
                    beforeSend: function (xhr)
                    {
                        xhr.setRequestHeader("x-pilvini-service", m_serviceId);
                        xhr.setRequestHeader("x-pilvini-begin", m_begin - 12 * 3600);
                        xhr.setRequestHeader("x-pilvini-end", m_end + 12 * 3600);
                    }
                })
                .done(function (data, status, xhr)
                {
                    if (begin === m_begin && end === m_end)
                    {
                        cacheEvents(m_begin - 12 * 3600, m_end + 12 * 3600, data.events);
                        render(data.events);
                    }
                })
                .fail(function (xhr, status, err)
                {
                    //ui.showError("Could not load channels: " + err);
                })
                .always(function ()
                {
                    busyIndicator.remove();
                    m_item.find("> div").css("visibility", "visible");
                });
    
            }, 300);
        }

        function render(events)
        {
            m_item.find("> div").html("");
            events.forEach(function (event)
            {
                var pos = (event.start - m_begin) * (200 / 1800) + 2;
                var width = event.duration * (200 / 1800) - 4;

                var eventBox = high.element(EventBox);
                eventBox
                .position(pos)
                .size(width)
                .add(
                    high.element(EventItem).id("item")
                    .title(event.name)
                    .subtitle(event.short)
                    .scheduled(high.predicate([m_recordings], function ()
                    {
                        return scheduled(m_serviceId, event.start, event.start + event.duration);
                    }))
                    .onClicked(function ()
                    {
                        if (m_onClicked)
                        {
                            var eventScheduled = eventBox.find("item").scheduled();
                            m_onClicked(event.eventId, event.name, event.short, eventScheduled);
                        }
                    })
                );

                m_item.find("> div").append(eventBox.get().get());
            });
        }

        this.get = function ()
        {
            return m_item;
        };
    }

    /* Element for positioning an event item.
     */
    function EventBox()
    {
        mid.defineProperties(this, {
            position: { set: setPosition, get: position },
            size: { set: setSize, get: size }
        });

        var m_position = 0;
        var m_size = 10;

        var m_item = $(
            low.tag("div")
            .style("position", "absolute")
            .style("top", "2px")
            .style("left", 0 + "px")
            .style("width", 10 + "px")
            .style("bottom", "2px")
            .html()
        );

        function setPosition(pos)
        {
            m_position = pos;
            m_item.css("left", pos + "px");
        }

        function position()
        {
            return m_position;
        }

        function setSize(size)
        {
            m_size = size;
            m_item.css("width", size + "px");
        }

        function size()
        {
            return m_size;
        }

        this.get = function ()
        {
            return m_item;
        };

        this.add = function (child)
        {
            m_item.append(child.get());
        };
    }

    /* Element representing an event.
     */
    function EventItem()
    {
        mid.defineProperties(this, {
            scheduled: { set: setScheduled, get: scheduled },
            title: { set: setTitle, get: title },
            subtitle: { set: setSubtitle, get: subtitle },
            onClicked: { set: setOnClicked, get: onClicked }
        });

        var m_scheduled = "no";
        var m_title = "";
        var m_subtitle = "";
        var m_onClicked = null;

        var m_item = $(
            low.tag("div")
            .style("position", "relative")
            .style("overflow", "hidden")
            .style("height", "3rem")
            .style("padding-top", "0.25rem")
            .style("padding-bottom", "0.25rem")
            .style("background-color", "var(--color-primary-background)")
            .style("border", "solid 2px var(--color-border)")
            .style("border-radius", "0.25rem")
            .on("click", "")
            .content(
                low.tag("h1")
            )
            .content(
                low.tag("h2")
            )
            .content(
                low.tag("div")
                .style("position", "absolute")
                .style("right", "0.5rem")
                .style("bottom", "0.5rem")
                .style("border-radius", "0.5rem")
                .style("width", "0.5rem")
                .style("height", "0.5rem")
                .style("background-color", "white")
            )
            .html()
        );

        m_item.on("click", function ()
        {
            if (m_onClicked)
            {
                m_onClicked();
            }
        });


        function setScheduled(scheduled)
        {
            m_scheduled = scheduled;
            var ledColor = scheduled === "full" ? "red"
                                                : scheduled === "partial" ? "darkred"
                                                                          : scheduled === "conflict" ? "orange" 
                                                                                                     : "grey";

            m_item.find("> div").css("background-color", ledColor);
        }

        function scheduled()
        {
            return m_scheduled;
        }

        function setTitle(title)
        {
            m_title = title;
            m_item.find("h1").html(low.escapeHtml(title));
        }

        function title()
        {
            return m_title;
        }

        function setSubtitle(subtitle)
        {
            m_subtitle = subtitle;
            m_item.find("h2").html(low.escapeHtml(subtitle));
        }

        function subtitle()
        {
            return m_subtitle;
        }

        function setOnClicked(cb)
        {
            m_onClicked = cb;
        }

        function onClicked()
        {
            return m_onClicked;
        }

        this.get = function ()
        {
            return m_item;
        };
    }

    /* Element representing a search item.
     */
    function SearchItem()
    {
        mid.defineProperties(this, {
            channel: { set: setChannel, get: channel },
            start: { set: setStart, get: start },
            duration: { set: setDuration, get: duration }
        });

        var m_channel = "";
        var m_start = 0;
        var m_duration = 0;

        var m_item = $(
            low.tag("li")
            .style("background-color", "var(--color-content-background)")
            .content(
                low.tag("h1")
            )
            .content(
                low.tag("h2")
            )
            .content(
                low.tag("div")
                .style("position", "relative")
                .style("padding", "0.5rem")
            )
            .html()
        );

        function setChannel(channel)
        {
            m_channel = channel;
            update();
        }

        function channel()
        {
            return m_channel;
        }

        function setStart(start)
        {
            m_start = start;
            update();
        }

        function start()
        {
            return m_start;
        }

        function setDuration(duration)
        {
            m_duration = duration;
            update();
        }

        function duration()
        {
            return m_duration;
        }

        function update()
        {
            var begin = new Date(m_start * 1000);
            var end = new Date((m_start + m_duration) * 1000);
            var time = begin.toDateString() + ", " +
                       formatTime(begin) + " - " +
                       formatTime(end);
            m_item.find("h1").html(low.escapeHtml(m_channel));
            m_item.find("h2").html(low.escapeHtml(time));
        }

        this.get = function ()
        {
            return m_item;
        };

        this.add = function (child)
        {
            m_item.find("> div").append(child.get());
        };
    }


    /* Loads the list of channels.
     */
    function loadChannels(callback)
    {
        if (m_channels.value())
        {
            // already loaded
            callback();
            return;
        }

        var busyIndicator = high.element(mid.BusyPopup).text("Loading");
        busyIndicator.show_();

        $.ajax({
            type: "GET",
            url: "/::pikku-dvr/channels",
            dataType: "json"
        })
        .done(function (data, status, xhr)
        {
            m_channels.assign(data);
            if (m_services.value().length === 0)
            {
                m_services.assign(Object.keys(data).sort(function (a, b)
                {
                    return m_channels.value()[a].toLowerCase() < m_channels.value()[b].toLowerCase() ? -1 : 1;
                }));
            }
            callback();
        })
        .fail(function (xhr, status, err)
        {
            ui.showError("Could not load channels: " + err);
            callback();
        })
        .always(function ()
        {
            busyIndicator.hide_();
        });
    }

    /* Loads the scheduled recordings.
     */
    function loadRecordings()
    {
        $.ajax({
            type: "GET",
            url: "/::pikku-dvr/recordings",
            dataType: "json"
        })
        .done(function (data, status, xhr)
        {
            m_recordings.assign(data.recordings || []);
        })
        .fail(function (xhr, status, err)
        {
            ui.showError("Could not load recordings: " + err);
        })
        .always(function ()
        {

        });
    }

    /* Schedules a recording.
     */
    function record(serviceId, event)
    {
        var name = event.short.name;
        if (event.short.text !== "")
        {
            name += " (" + event.short.text + ")";
        }

        var data = {
            serviceId: serviceId,
            start: event.start,
            duration: event.duration,
            name: name
        };

        var busyIndicator = high.element(mid.BusyPopup).text("Scheduling");
        busyIndicator.show_();

        $.ajax({
            type: "POST",
            url: "/::pikku-dvr/record",
            data: JSON.stringify(data)
        })
        .done(function (data, status, xhr)
        {
            loadRecordings();
        })
        .fail(function (xhr, status, err)
        {
            ui.showError("Could not schedule recording: " + err);
        })
        .always(function ()
        {
            busyIndicator.hide_();
        });
    }

    /* Cancels a recording.
     */
    function cancelRecording(serviceId, at)
    {
        var data = {
            serviceId: serviceId,
            at: at
        };

        var busyIndicator = high.element(mid.BusyPopup).text("Canceling");
        busyIndicator.show_();

        $.ajax({
            type: "POST",
            url: "/::pikku-dvr/cancel",
            data: JSON.stringify(data)
        })
        .done(function (data, status, xhr)
        {
            loadRecordings();
        })
        .fail(function (xhr, status, err)
        {
            ui.showError("Could not cancel recording: " + err);
        })
        .always(function ()
        {
            busyIndicator.hide_();
        });
    }

    function openChannelsMenu(page)
    {
        var menu = high.element(mid.Menu)
        .add(
            high.element(mid.MenuItem).text("Edit Favorites...")
            .onClicked(openChannelsPage)
        )
        .add(
            high.element(mid.Separator)
        );

        m_services.value().forEach(function (serviceId)
        {
            menu.add(
                high.element(mid.MenuItem).text(m_channels.value()[serviceId])
                .onClicked(function ()
                {
                    page.find("channelsList").scrollTo_(serviceId);
                })
            );
        });

        menu.popup_(page.header().get());
    }

    function showSearchDialog()
    {
        var dlg = high.element(mid.Dialog).title("Search")
        .button(
            high.element(mid.Button).text("Search")
            .isDefault(true)
            .onClicked(function ()
            {
                var searchTerm = dlg.find("input").get().text;
                openSearchPage(searchTerm);
                dlg.close_();
            })
        )
        .button(
            high.element(mid.Button).text("Cancel")
            .onClicked(function ()
            {
                dlg.close_();
            })
        )
        .add(
            high.element(mid.Labeled).text("Search for:")
            .add(
                high.element(mid.TextInput).id("input")
            )
        );
        dlg.show_();
    }

    /* Opens the main page.
     */
    function openPage()
    {
        var beginTime = high.binding(0);
        var endTime = high.binding(0);

        var now = new Date().getTime() / 1000;

        var page = high.element(mid.Page);
        page
        .header(
            high.element(mid.PageHeader).title("DVR")
            .subtitle(high.predicate([beginTime], function ()
            {
                var d = new Date(beginTime.value() * 1000);
                return d.toDateString();
            }))
            .onClicked(function () { openChannelsMenu(page); })
            .left(
                high.element(mid.IconButton).icon("sh-icon-back")
                .onClicked(function () { page.pop_(); page.dispose(); })
            )
            .left(
                high.element(mid.IconButton).icon("sh-icon-media-previous")
                .onClicked(function ()
                {
                    var t = Math.max(now, beginTime.value() - 24 * 3600);
                    page.find("timeline").scrollTo_(t);
                })
            )
            .left(
                high.element(mid.IconButton).icon("sh-icon-media-rwd")
                .onClicked(function ()
                {
                    var t = Math.max(now, beginTime.value() - 3600);
                    page.find("timeline").scrollTo_(t);
                })
            )
            .right(
                high.element(mid.IconButton).icon("sh-icon-media-fwd")
                .onClicked(function ()
                {
                    var t = Math.min(now + 6 * 24 * 3600, beginTime.value() + 3600);
                    page.find("timeline").scrollTo_(t);
                })
            )
            .right(
                high.element(mid.IconButton).icon("sh-icon-media-next")
                .onClicked(function ()
                {
                    var t = Math.min(now + 6 * 24 * 3600, beginTime.value() + 24 * 3600);
                    page.find("timeline").scrollTo_(t);
                })
            )
            .right(
                high.element(mid.IconButton).icon("sh-icon-search")
                .onClicked(showSearchDialog)
            )
        )
        .add(
            high.element(mid.ListModelView).id("channelsList")
            .delegate(function (serviceId)
            {
                var item = high.element(ChannelItem);
                item
                .title(m_channels.value()[serviceId] || "")
                .serviceId(serviceId)
                .end(endTime)
                .begin(beginTime)
                .active(high.predicate([m_scrollPosition], function ()
                {
                    if (page.get().get().css("display") === "none")
                    {
                        return false;
                    }
                    else
                    {
                        var topPos = $(document).scrollTop();
                        var bottomPos = topPos + $(window).height();
                        var pos = item.get().get().offset().top;
                        var height = item.get().get().height();
    
                        return pos !== 0 && pos < bottomPos && pos + height > topPos;
                    }
                }))
                .onClicked(function (eventId, name, short, scheduled)
                {
                    showEventDialog(serviceId, eventId, name, short, scheduled);
                });
                return item.get();
            })
            .model(
                high.element(mid.ListModel).data(m_services)
            )
        )
        .add(
            high.element(Timeline).id("timeline")
            .begin(now - 1800)
            .end(now + 7 * 24 * 3600)
            .recordings(m_recordings)
            .scale(1)
            .onMoved(function (begin, end)
            {
                endTime.assign(end);
                beginTime.assign(begin);
            })
            .onClicked(function (serviceId, start)
            {
                var channelsListView = page.find("channelsList").get();
                for (var i = 0; i < channelsListView.size; ++i)
                {
                    var item = channelsListView.item(i);
                    if (item.serviceId === serviceId)
                    {
                        $(document).scrollTop(item.get().offset().top - $(window).height() / 2);
                    }
                }
            })
        );
        page.push_(function ()
        {
            page.find("channelsList").get().get().css("margin-top", "3rem");
            m_scrollPosition.update();
        });

        page.find("timeline").update_();

        loadRecordings();
    }


    /* Opens the channels editor page.
     */
    function openChannelsPage()
    {
        var allServices = Object.keys(m_channels.value())
        .sort(function (a, b)
        {
            return m_channels.value()[a].toLowerCase() < m_channels.value()[b].toLowerCase() ? -1 : 1;
        });
        var services = m_services.value().slice()
        .sort(function (a, b)
        {
            return m_channels.value()[a].toLowerCase() < m_channels.value()[b].toLowerCase() ? -1 : 1;
        });

        var page = high.element(mid.Page)
        .onSwipeBack(function () { page.pop_(); })
        .header(
            high.element(mid.PageHeader).title("Channels")
            .left(
                high.element(mid.IconButton).icon("sh-icon-back")
                .onClicked(function ()
                {
                    services.sort(function (a, b)
                    {
                        return m_channels.value()[a].toLowerCase() < m_channels.value()[b].toLowerCase() ? -1 : 1;
                    });
                    m_services.assign(services);
                    storage.store("/pikku-dvr/services", services, function ()
                    {
                        console.log("services saved");
                    });
                    page.pop_();
                })
            )
            .right(
                high.element(mid.IconButton).icon("sh-icon-menu")
                .menu(
                    high.element(mid.Menu)
                    .add(
                        high.element(mid.MenuItem).text("Select All")
                        .onClicked(function ()
                        {
                            services = allServices.slice();
                            var view = page.find("listview");
                            for (var i = 0; i < view.size(); ++i)
                            {
                                view.item_(i).selected = true;
                            }
                        })
                    )
                    .add(
                        high.element(mid.MenuItem).text("Unselect All")
                        .onClicked(function ()
                        {
                            services = [];
                            var view = page.find("listview");
                            for (var i = 0; i < view.size(); ++i)
                            {
                                view.item_(i).selected = false;
                            }
                        })
                    )
                )
            )
        )
        .add(
            high.element(mid.ListModelView).id("listview")
            .delegate(function (serviceId)
            {
                var item = high.element(mid.ListItem)
                .title(m_channels.value()[serviceId])
                .selected(services.indexOf(serviceId) !== -1)
                .action(["sh-icon-checked-circle", function ()
                {
                    item.selected(! item.selected());
                    if (item.selected())
                    {
                        services.push(serviceId);
                    }
                    else
                    {
                        var idx = services.indexOf(serviceId);
                        if (idx !== -1)
                        {
                            services.splice(idx, 1);
                        }
                    }
                }]);

                return item.get();
            })
            .model(
                high.element(mid.ListModel)
                .data(allServices)
            )
        );

        page.push_();
    }

    /* Opens the search page.
     */
    function openSearchPage(searchTerm)
    {
        var page = high.element(mid.Page)
        .onSwipeBack(function () { page.pop_(); })
        .header(
            high.element(mid.PageHeader).title("Search").subtitle(searchTerm)
            .left(
                high.element(mid.IconButton).icon("sh-icon-back")
                .onClicked(function () { page.pop_(); })
            )
        )
        .add(
            high.element(mid.ListView).id("list")
        );
        page.push_();

        var data = {
            searchTerm: searchTerm
        };

        var busyIndicator = high.element(mid.BusyPopup).text("Searching");
        busyIndicator.show_();

        $.ajax({
            type: "POST",
            url: "/::pikku-dvr/search",
            data: JSON.stringify(data),
            dataType: "json"
        })
        .done(function (data, status, xhr)
        {
            data.result.forEach(function (event)
            {
                var item = high.element(SearchItem);
                item
                .channel(m_channels.value()[event.serviceId] || "?" + event.serviceId)
                .start(event.start)
                .duration(event.duration)
                .add(
                    high.element(EventItem).id("eventItem")
                    .title(event.name)
                    .subtitle(event.short)
                    .scheduled(high.predicate([m_recordings], function ()
                    {
                        return scheduled(event.serviceId, event.start, event.start + event.duration);
                    }))
                    .onClicked(function ()
                    {
                        showEventDialog(event.serviceId,
                                      event.eventId,
                                      event.name,
                                      event.short,
                                      item.find("eventItem").scheduled());
                    })
                );

                page.find("list").add(item);
            });
        })
        .fail(function (xhr, status, err)
        {
            ui.showError("Could not load results: " + err);
        })
        .always(function ()
        {
            busyIndicator.hide_();
        });
    }

    /* Shows the event information dialog.
     */
    function showEventDialog(serviceId, eventId, name, short, scheduled)
    {
        var event = null;

        var dlg = high.element(mid.Dialog)
        .title(m_channels.value()[serviceId])
        .button(
            high.element(mid.Button).text("Close")
            .onClicked(function () { dlg.close_(); })
        )
        .add(
            high.element(mid.Headline)
            .title(name)
            .subtitle(short)
        )
        .add(
            high.element(mid.Separator)
        )
        .add(
            high.element(mid.Labeled).text("Time")
            .add(
                high.element(mid.Text).id("time")
            )
        )
        .add(
            high.element(mid.Labeled).text("Record")
            .add(
                high.element(mid.Switch).id("recordSwitch")
                .enabled(scheduled !== "conflict")
                .checked(scheduled === "full")
                .onToggled(function (checked)
                {
                    if (checked)
                    {
                        record(serviceId, event);
                    }
                    else
                    {
                        cancelRecording(serviceId, event.start);
                    }
                })
            )
        )
        .add(
            high.element(mid.Separator)
        )
        .add(
            high.element(mid.Label).id("description")
        );

        dlg.show_();
        
        var busyIndicator = high.element(mid.BusyPopup).text("Loading");
        busyIndicator.show_();

        $.ajax({
            type: "GET",
            url: "/::pikku-dvr/event",
            dataType: "json",
            beforeSend: function (xhr)
            {
                xhr.setRequestHeader("x-pilvini-service", serviceId);
                xhr.setRequestHeader("x-pilvini-event", eventId);
            }
        })
        .done(function (data, status, xhr)
        {
            console.log(data);

            var begin = new Date(data.start * 1000);
            var end = new Date((data.start + data.duration) * 1000);

            dlg.find("description").text(data.extended.text);
            dlg.find("time").text(begin.toDateString() + ", " +
                                  formatTime(begin) + " - " + formatTime(end));
            event = data;
        })
        .fail(function (xhr, status, err)
        {
            ui.showError("Could not load information: " + err);
        })
        .always(function ()
        {
            busyIndicator.hide_();
        });
    }

    $(document).scroll(function (event)
    {
        m_scrollPosition.assign($(document).scrollTop());
    });

    files.actionsMenu().find("tools-menu")
    .add(
        high.element(mid.MenuItem).text("DVR")
        .onClicked(function ()
        {
            loadChannels(openPage);
        })
    );

    storage.load("/pikku-dvr/services", function (value)
    {
        if (value)
        {
            m_services.assign(value);
        }
    });
});