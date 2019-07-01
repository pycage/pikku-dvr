"use strict";

(function ()
{
    var m_channels = sh.binding(null);
    var m_services = sh.binding([]);
    var m_recordings = sh.binding([]);
    var m_scrollPosition = sh.binding(0);

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

    /* Returns if the given event is scheduled.
     */
    function scheduled(serviceId, begin, end)
    {
        var recs = m_recordings.value();
        var covered = false;
        var full = false;
        for (var i = 0; i < recs.length; ++i)
        {
            var rec = recs[i];
            var recStart = Number.parseInt(rec.start);
            var recDuration = Number.parseInt(rec.duration);

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
        return full ? "full" 
                    : covered ? "partial"
                              : "no";
    }

    /* Element representing a timeline.
     */
    function Timeline()
    {
        Object.defineProperties(this, {
            begin: { set: setBegin, get: begin, enumerable: true },
            end: { set: setEnd, get: end, enumerable: true },
            recordings: { set: setRecordings, get: recordings, enumerable: true },
            scale: { set: setScale, get: scale, enumerable: true },
            onMoved: { set: setOnMoved, get: onMoved, enumerable: true },
            onClicked: { set: setOnClicked, get: onClicked, enumerable: true }
        });

        var m_begin = 0;
        var m_end = 0;
        var m_recordings = [];
        var m_scale = 1;
        var m_onMoved = null;
        var m_onClicked = null;

        var m_isDragging = false;

        var m_item = $(
            sh.tag("div")
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
                sh.tag("div")
            )
            .content(
                sh.tag("div")
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
                    sh.tag("div")
                    .style("position", "absolute")
                    .style("background-color", "var(--color-highlight-background)")
                    .style("top", "1rem")
                    .style("left", pos + "px")
                    .style("bottom", "0")
                    .style("width", width + "px")
                    .style("overflow", "hidden")
                    .content(
                        sh.tag("h2").content(rec.name)
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
                    sh.tag("div")
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

    /* Element representing the list of channels.
     */
    function ChannelsListView()
    {
        Object.defineProperties(this, {
            channels: { set: setChannels, get: channels, enumerable: true },
            services: { set: setServices, get: services, enumerable: true },
            begin: { set: setBegin, get: begin, enumerable: true },
            end: { set: setEnd, get: end, enumerable: true }
        });

        var base = new sh.ListView();
        sh.extend(this, base);
        base.get().css("margin-top", "3rem");

        var m_channels = { };
        var m_services = [];
        var m_begin = 0;
        var m_end = 0;

        var m_items = [];

        function setChannels(c)
        {
            m_channels = c;
            update();
        }

        function channels()
        {
            return m_channels;
        }

        function setServices(s)
        {
            m_services = s;
            update();
        }

        function services()
        {
            return m_services;
        }

        function setBegin(begin)
        {
            m_begin = begin;
            m_items.forEach(function (item)
            {
                item.begin(begin);
            });
        }

        function begin()
        {
            return m_begin;
        }

        function setEnd(end)
        {
            m_end = end;
            m_items.forEach(function (item)
            {
                item.end(end);
            });
        }

        function end()
        {
            return m_end;
        }

        function update()
        {
            m_items.forEach(function (item)
            {
                item.get().get().remove();
                item.dispose();
            });
            m_items = [];

            m_services.forEach(function (serviceId)
            {
                var item = sh.element(ChannelItem).title(m_channels[serviceId])
                .serviceId(serviceId)
                .begin(m_begin)
                .end(m_end)
                .onClicked(function (eventId, name, short, scheduled)
                {
                    openEventPage(serviceId, eventId, name, short, scheduled);
                });
                
                item.active(sh.predicate([m_scrollPosition], function ()
                {
                    var topPos = $(document).scrollTop();
                    var bottomPos = topPos + $(window).height();
                    var pos = item.get().get().offset().top;
                    var height = item.get().get().height();
                    //console.log("pos " + pos + " height " + height);
                    return pos !== 0 && pos < bottomPos && pos + height > topPos;
                }));
                
                m_items.push(item);
                base.add(item.get());
            });
            m_scrollPosition.update();
        }

        this.scrollTo = function (serviceId)
        {
            for (var i = 0; i < base.size(); ++i)
            {
                var item = base.item(i);
                if (item.serviceId === serviceId)
                {
                    $(document).scrollTop(item.get().offset().top - $(window).height() / 2);
                }
            }
        };
    }

    /* Element representing a channel.
     */
    function ChannelItem()
    {    
        Object.defineProperties(this, {
            title: { set: setTitle, get: title, enumerable: true },
            serviceId: { set: setServiceId, get: serviceId, enumerable: true },
            begin: { set: setBegin, get: begin, enumerable: true },
            end: { set: setEnd, get: end, enumerable: true },
            scale: { set: setScale, get: scale, enumerable: true },
            active: { set: setActive, get: active, enumerable: true },
            onClicked: { set: setOnClicked, get: onClicked, enumerable: true }
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
            sh.tag("li")
            .style("background-color", "var(--color-content-background)")
            .style("height", "5rem")
            .style("overflow", "hidden")
            .content(
                sh.tag("h1")
            )
            .content(
                sh.tag("div")
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
            m_item.find("> h1").html(sh.escapeHtml(title) + " ");
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
                    sh.tag("span").class("sh-busy-indicator")
                    .html()
                );
                m_item.find("> h1").append(busyIndicator);
    
                console.log("fetch from server: " + m_begin + " - " + m_end);
                $.ajax({
                    type: "GET",
                    url: "/::pikku-dvr/epg",
                    dataType: "json",
                    beforeSend: function (xhr)
                    {
                        xhr.setRequestHeader("x-pilvini-service", m_serviceId);
                        xhr.setRequestHeader("x-pilvini-begin", m_begin);
                        xhr.setRequestHeader("x-pilvini-end", m_end);
                    }
                })
                .done(function (data, status, xhr)
                {
                    if (begin === m_begin && end === m_end)
                    {
                        cacheEvents(m_begin, m_end, data.events);
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

                var eventScheduled = scheduled(m_serviceId, event.start, event.start + event.duration);

                var eventItem = new EventItem();
                eventItem.scheduled = eventScheduled;
                eventItem.title = event.name;
                eventItem.subtitle = event.short;
                eventItem.onClicked = function ()
                {
                    if (m_onClicked)
                    {
                        m_onClicked(event.eventId, event.name, event.short, eventScheduled);
                    }
                };

                var eventBox = new EventBox();
                eventBox.position = pos;
                eventBox.size = width;
                eventBox.add(eventItem);

                m_item.find("> div").append(eventBox.get());
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
        Object.defineProperties(this, {
            position: { set: setPosition, get: position, enumerable: true },
            size: { set: setSize, get: size, enumerable: true }
        });

        var m_position = 0;
        var m_size = 10;

        var m_item = $(
            sh.tag("div")
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
        Object.defineProperties(this, {
            scheduled: { set: setScheduled, get: scheduled, enumerable: true },
            title: { set: setTitle, get: title, enumerable: true },
            subtitle: { set: setSubtitle, get: subtitle, enumerable: true },
            onClicked: { set: setOnClicked, get: onClicked, enumerable: true }
        });

        var m_scheduled = "no";
        var m_title = "";
        var m_subtitle = "";
        var m_onClicked = null;

        var m_item = $(
            sh.tag("div")
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
                sh.tag("h1")
            )
            .content(
                sh.tag("h2")
            )
            .content(
                sh.tag("div")
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
            m_item.find("h1").html(sh.escapeHtml(title));
        }

        function title()
        {
            return m_title;
        }

        function setSubtitle(subtitle)
        {
            m_subtitle = subtitle;
            m_item.find("h2").html(sh.escapeHtml(subtitle));
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
        Object.defineProperties(this, {
            channel: { set: setChannel, get: channel, enumerable: true },
            start: { set: setStart, get: start, enumerable: true },
            duration: { set: setDuration, get: duration, enumerable: true }
        });

        var m_channel = "";
        var m_start = 0;
        var m_duration = 0;

        var m_item = $(
            sh.tag("li")
            .style("background-color", "var(--color-content-background)")
            .content(
                sh.tag("h1")
            )
            .content(
                sh.tag("div")
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
            var title = m_channel + " " + formatTime(new Date(m_start * 1000));
            m_item.find("h1").html(sh.escapeHtml(title));
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

        var busyIndicator = sh.element(sh.BusyPopup).text("Loading");
        busyIndicator.show_();

        $.ajax({
            type: "GET",
            url: "/::pikku-dvr/channels",
            dataType: "json"
        })
        .done(function (data, status, xhr)
        {
            m_channels.assign(data);
            m_services.assign(Object.keys(data).sort(function (a, b)
            {
                return m_channels.value()[a].toLowerCase() < m_channels.value()[b].toLowerCase() ? -1 : 1;
            }));
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

        var busyIndicator = sh.element(sh.BusyPopup).text("Scheduling");
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

        var busyIndicator = sh.element(sh.BusyPopup).text("Canceling");
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
        var menu = sh.element(sh.Menu)
        .add(
            sh.element(sh.MenuItem).text("Edit Favorites...")
            .onClicked(openChannelsPage)
        )
        .add(
            sh.element(sh.Separator)
        );

        m_services.value().forEach(function (serviceId)
        {
            menu.add(
                sh.element(sh.MenuItem).text(m_channels.value()[serviceId])
            );
        });

        menu.popup_(page.header.get());
    }

    function showSearchDialog()
    {
        var dlg = sh.element(sh.Dialog).title("Search")
        .button(
            sh.element(sh.Button).text("Search")
            .onClicked(function ()
            {
                var searchTerm = dlg.find("input").get().text;
                openSearchPage(searchTerm);
                dlg.close_();
            })
        )
        .button(
            sh.element(sh.Button).text("Cancel")
            .onClicked(function ()
            {
                dlg.close_();
            })
        )
        .add(
            sh.element(sh.Labeled).text("Search for:")
            .add(
                sh.element(sh.TextInput).id("input")
            )
        );
        dlg.show_();
    }

    /* Opens the main page.
     */
    function openPage()
    {
        var beginTime = sh.binding(0);
        var endTime = sh.binding(0);

        var now = new Date().getTime() / 1000;

        var page = sh.element(sh.NSPage)
        .header(
            sh.element(sh.PageHeader).title("DVR")
            .subtitle(sh.predicate([beginTime], function ()
            {
                var d = new Date(beginTime.value() * 1000);
                return d.toDateString();
            }))
            .onClicked(function () { openChannelsMenu(page.get()); })
            .left(
                sh.element(sh.IconButton).icon("sh-icon-back")
                .onClicked(function () { page.dispose(); page.pop_(); })
            )
            .right(
                sh.element(sh.IconButton).icon("sh-icon-search")
                .onClicked(showSearchDialog)
            )
        )
        .add(
            sh.element(ChannelsListView).id("channelsList")
            .begin(beginTime)
            .end(endTime)
        )
        .add(
            sh.element(Timeline).id("timeline")
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
                page.find("channelsList").scrollTo_(serviceId);
                page.find("timeline").scrollTo_(start);
            })
        );
        page.push_(function ()
        {
            page.find("channelsList")
            .channels(m_channels)
            .services(m_services);
        });

        page.find("timeline").update_();

        loadRecordings();
    }


    /* Opens the channels editor page.
     */
    function openChannelsPage()
    {
        var services = m_services.value().slice();

        var page = sh.element(sh.NSPage)
        .onSwipeBack(function () { page.pop_(); })
        .header(
            sh.element(sh.PageHeader).title("Channels")
            .left(
                sh.element(sh.IconButton).icon("sh-icon-back")
                .onClicked(function ()
                {
                    m_services.assign(services);
                    page.pop_();
                })
            )
            .right(
                sh.element(sh.IconButton).icon("sh-icon-menu")
            )
        )
        .add(
            sh.element(sh.ListView).id("listview")
        );

        for (var serviceId in m_channels.value())
        {
            var item = sh.element(sh.ListItem).title(m_channels.value()[serviceId])
            .selected(services.indexOf(serviceId) !== -1);
            item.action(["sh-icon-checked-circle", function (svcId, item)
            {
                // closure
                return function ()
                {
                    var listItem = item.get();
                    listItem.selected = ! listItem.selected;
                    if (listItem.selected)
                    {
                        services.push(svcId);
                    }
                    else
                    {
                        var idx = services.indexOf(svcId);
                        if (idx !== -1)
                        {
                            services = services.splice(idx, 1);
                        }
                    }
                };
            }(serviceId, item)]);

            page.find("listview").add(item);
        }

        page.push_();
    }

    /* Opens the search page.
     */
    function openSearchPage(searchTerm)
    {
        var page = sh.element(sh.NSPage)
        .onSwipeBack(function () { page.pop_(); })
        .header(
            sh.element(sh.PageHeader).title("Search").subtitle(searchTerm)
            .left(
                sh.element(sh.IconButton).icon("sh-icon-back")
                .onClicked(function () { page.pop_(); })
            )
        )
        .add(
            sh.element(sh.ListView).id("list")
        );
        page.push_();

        var data = {
            searchTerm: searchTerm
        };

        var busyIndicator = sh.element(sh.BusyPopup).text("Searching");
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
                var item = sh.element(SearchItem);
                item
                .channel(m_channels.value()[event.serviceId] || "?" + event.serviceId)
                .start(event.start)
                .duration(event.duration)
                .add(
                    sh.element(EventItem).id("eventItem")
                    .title(event.name)
                    .subtitle(event.short)
                    .scheduled(sh.predicate([m_recordings], function ()
                    {
                        return scheduled(event.serviceId, event.start, event.start + event.duration);
                    }))
                    .onClicked(function ()
                    {
                        openEventPage(event.serviceId,
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

    /* Opens the event information page.
     */
    function openEventPage(serviceId, eventId, name, short, scheduled)
    {
        var event = null;

        var page = sh.element(sh.NSPage)
        .onSwipeBack(function () { page.pop_(); })
        .header(
            sh.element(sh.PageHeader).title(name).subtitle(short)
            .left(
                sh.element(sh.IconButton).icon("sh-icon-back")
                .onClicked(function () { page.pop_(); })
            )
        )
        .add(
            sh.element(sh.Label).text(m_channels.value()[serviceId])
        )
        .add(
            sh.element(sh.Labeled).text("Start")
            .add(
                sh.element(sh.Label).id("start")
            )
        )
        .add(
            sh.element(sh.Labeled).text("Duration")
            .add(
                sh.element(sh.Label).id("duration")
            )
        )
        .add(
            sh.element(sh.Label).id("description")
        )
        .add(
            sh.element(sh.Labeled).text("Record")
            .add(
                sh.element(sh.Switch).id("recordSwitch")
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
        );

        page.push_();

        var busyIndicator = sh.element(sh.BusyPopup).text("Loading");
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
            page.find("description").text(data.extended.text);
            page.find("start").text(formatTime(new Date(data.start * 1000)));
            page.find("duration").text(data.duration + " s");
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
        sh.element(sh.MenuItem).text("DVR")
        .onClicked(function ()
        {
            loadChannels(openPage);
        })
    );

})();