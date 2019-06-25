"use strict";

(function ()
{
    var m_channels = null;
    var m_services = [];
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

    /* Element representing a timeline.
     */
    function Timeline()
    {
        Object.defineProperties(this, {
            begin: { set: setBegin, get: begin, enumerable: true },
            end: { set: setEnd, get: end, enumerable: true },
            recordings: { set: setRecordings, get: recordings, enumerable: true },
            scale: { set: setScale, get: scale, enumerable: true },
            onMoved: { set: setOnMoved, get: onMoved, enumerable: true }
        });

        var m_begin = 0;
        var m_end = 0;
        var m_recordings = [];
        var m_scale = 1;
        var m_onMoved = null;
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
            this.offset = event.offsetX - m_item.scrollLeft();
        });
        m_item.on("mousemove", function (event)
        {
            if (m_isDragging)
            {
                var pos = event.offsetX - m_item.scrollLeft();
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
                    .style("left", pos + "px")
                    .style("width", width + "px")
                    .style("height", "3rem")
                    .html()
                );
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
                    .style("height", "3rem")
                    .style("font-size", "80%")
                    .style("border-left", "solid 2px var(--color-primary)")
                    .style("padding-left", "0.25em")
                    .style("line-height", "3rem")
                    .style("overflow", "hidden")
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
    }

    function ChannelsListView()
    {
        var base = new sh.ListView();
        sh.extend(this, base);
        base.get().css("margin-top", "6rem");
    }

    function ChannelItem()
    {    
        Object.defineProperties(this, {
            title: { set: setTitle, get: title, enumerable: true },
            serviceId: { set: setServiceId, get: serviceId, enumerable: true },
            begin: { set: setBegin, get: begin, enumerable: true },
            end: { set: setEnd, get: end, enumerable: true },
            recordings: { set: setRecordings, get: recordings, enumerable: true },
            scale: { set: setScale, get: scale, enumerable: true },
            active: { set: setActive, get: active, enumerable: true },
            onClicked: { set: setOnClicked, get: onClicked, enumerable: true }
        });

        var m_title = "";
        var m_serviceId = 0;
        var m_begin = 0;
        var m_end = 0;
        var m_recordings = [];
        var m_scale = 1;
        var m_isActive = false;
        var m_onClicked = null;

        var m_cachedEvents = [];
        var m_cachedRanges = [];

        var m_item = $(
            sh.tag("li")
            .style("background-color", "var(--color-content-background)")
            .style("height", "80px")
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
            m_item.find("> h1").html(sh.escapeHtml(title));
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

        function setRecordings(recs)
        {
            m_recordings = recs;
            if (m_isActive)
            {
                update();
            }
        }

        function recordings()
        {
            return m_recordings;
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

        function scheduled(begin, end)
        {
            var covered = false;
            var full = false;
            for (var i = 0; i < m_recordings.length; ++i)
            {
                var rec = m_recordings[i];
                var recStart = Number.parseInt(rec.start);
                var recDuration = Number.parseInt(rec.duration);

                if (rec.serviceId === m_serviceId && begin >= recStart && end <= (recStart + recDuration))
                {
                    covered = true;
                    full = true;
                }
                else if (rec.serviceId === m_serviceId && begin < (recStart + recDuration) && end > recStart)
                {
                    covered = true;
                }
            }
            return full ? "full" 
                        : covered ? "partial"
                                  : "no";
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
                cacheEvents(m_begin, m_end, data.events);
                render(data.events);
            })
            .fail(function (xhr, status, err)
            {
                //ui.showError("Could not load channels: " + err);
            })
            .always(function ()
            {
                //busyIndicator.hide_();
            });
        }

        function render(events)
        {
            m_item.find("> div").html("");
            events.forEach(function (event)
            {
                var pos = (event.start - m_begin) * (200 / 1800) + 2;
                var width = event.duration * (200 / 1800) - 4;

                var eventScheduled = scheduled(event.start, event.start + event.duration);
                var ledColor;
                switch (eventScheduled)
                {
                case "full":
                    ledColor = "red";
                    break;
                case "partial":
                    ledColor = "darkred";
                    break;
                case "no":
                    ledColor = "grey";
                    break;
                }

                var eventBox = $(
                    sh.tag("div")
                    .style("position", "absolute")
                    .style("overflow", "hidden")
                    .style("top", "2px")
                    .style("left", pos + "px")
                    .style("width", width + "px")
                    .style("bottom", "2px")
                    .style("background-color", "var(--color-primary-background)")
                    .style("border", "solid 2px var(--color-border)")
                    .style("border-radius", "0.25rem")
                    .on("click", "")
                    .content(
                        sh.tag("h1").content(event.name)
                    )
                    .content(
                        sh.tag("h2").content(event.short)
                    )
                    .content(
                        sh.tag("div")
                        .style("position", "absolute")
                        .style("right", "0.5rem")
                        .style("bottom", "0.5rem")
                        .style("border-radius", "0.5rem")
                        .style("width", "0.5rem")
                        .style("height", "0.5rem")
                        .style("background-color", ledColor)
                    )
                    .html()
                );

                eventBox.on("click", function ()
                {
                    if (m_onClicked)
                    {
                        m_onClicked(event.eventId, event.name, event.short, eventScheduled);
                    }
                });
                m_item.find("> div").append(eventBox);
            });
        }

        this.get = function ()
        {
            return m_item;
        };
    }

    /* Loads the list of channels.
     */
    function loadChannels(callback)
    {
        if (m_channels)
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
            m_channels = data;
            m_services = Object.keys(data).sort(function (a, b)
            {
                return m_channels[a].toLowerCase() < m_channels[b].toLowerCase() ? -1 : 1;
            });
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

        m_services.forEach(function (serviceId)
        {
            menu.add(
                sh.element(sh.MenuItem).text(m_channels[serviceId])
            );
        });

        menu.popup_(page.header.get());
    }

    /* Opens the main page.
     */
    function openPage()
    {
        var beginTime = sh.binding(0);
        var endTime = sh.binding(0);

        var now = new Date().getTime() / 1000;

        var page = sh.element(sh.NSPage)
        .onSwipeBack(function () { page.dispose(); page.pop_(); })
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
                sh.element(sh.IconButton).icon("sh-icon-bug")
            )
        )
        .add(
            sh.element(ChannelsListView).id("channelsList")
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
        );
        page.push_();

        m_services.forEach(function (serviceId)
        {
            var item = sh.element(ChannelItem).title(m_channels[serviceId])
            .serviceId(serviceId)
            .begin(beginTime)
            .end(endTime)
            .recordings(m_recordings)
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
            
            page.find("channelsList").add(item);
        });

        m_scrollPosition.update();
        page.find("timeline").update_();

        loadRecordings();
    }


    /* Opens the channels editor page.
     */
    function openChannelsPage()
    {
        var services = m_services.slice();

        var page = sh.element(sh.NSPage)
        .onSwipeBack(function () { page.pop_(); })
        .header(
            sh.element(sh.PageHeader).title("Channels")
            .left(
                sh.element(sh.IconButton).icon("sh-icon-back")
                .onClicked(function ()
                {
                    m_services = services;
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

        for (var serviceId in m_channels)
        {
            var item = sh.element(sh.ListItem).title(m_channels[serviceId])
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
            sh.element(sh.Label).text(m_channels[serviceId])
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
            //ui.showError("Could not load channels: " + err);
        })
        .always(function ()
        {
            //busyIndicator.hide_();
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