"use strict";

(function ()
{
    var m_channels = { };
    var m_services = [];
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
            scale: { set: setScale, get: scale, enumerable: true },
            onMoved: { set: setOnMoved, get: onMoved, enumerable: true }
        });

        var m_begin = 0;
        var m_end = 0;
        var m_scale = 1;
        var m_onMoved = null;

        var m_item = $(
            sh.tag("div")
            .style("position", "fixed")
            .style("top", "3rem")
            .style("width", "100%")
            .style("height", "3rem")
            .style("background-color", "var(--color-content-background)")
            .style("color", "var(--primary-color)")
            .style("white-space", "nowrap")
            .style("overflow", "scroll")
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
            m_item.html("");
            var begin = m_begin - (m_begin % 1800);
            for (var i = begin; i < m_end; i += 1800)
            {
                var pos = (i - m_begin) * 200 / 1800;

                var label = formatTime(new Date(i * 1000));
                var tick = $(
                    sh.tag("div")
                    .style("position", "absolute")
                    .style("left", pos + "px")
                    .style("width", "200px")
                    .style("height", "100%")
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
                m_item.append(tick);
            }
        }

        this.get = function ()
        {
            return m_item;
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

        function update()
        {
            //console.log("GET serviceId: " + m_serviceId + " from " + m_begin + " until " + m_end);

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
                    .html()
                );

                eventBox.on("click", function ()
                {
                    if (m_onClicked)
                    {
                        m_onClicked(event.eventId, event.name, event.short);
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
            sh.element(Timeline)
            .begin(now - 1800)
            .end(now + 7 * 24 * 3600)
            .scale(1)
            .onMoved(function (begin, end)
            {
                beginTime.assign(begin);
                endTime.assign(end);
            })
        );
        page.push_();

        m_services.forEach(function (serviceId)
        {
            var item = sh.element(ChannelItem).title(m_channels[serviceId])
            .serviceId(serviceId)
            .begin(beginTime)
            .end(endTime)
            .onClicked(function (eventId, name, short)
            {
                openEventPage(serviceId, eventId, name, short);
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
        })
        .fail(function (xhr, status, err)
        {
            ui.showError("Could not load channels: " + err);
        })
        .always(function ()
        {
            busyIndicator.hide_();
        });
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
    function openEventPage(serviceId, eventId, name, short)
    {
        var page = sh.element(sh.NSPage)
        .onSwipeBack(function () { page.pop_(); })
        .header(
            sh.element(sh.PageHeader).title(name).subtitle(short)
            .left(
                sh.element(sh.IconButton).icon("sh-icon-back")
                .onClicked(function () { page.pop_(); })
            )
            .right(
                sh.element(sh.IconButton).icon("sh-icon-bug")
            )
        )
        .add(
            sh.element(sh.Label).id("description")
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
        .onClicked(openPage)
    );

    openPage();
})();