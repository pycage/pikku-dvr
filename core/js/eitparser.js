"use strict";

const modFs = require("fs"),
      modProcess = require("process");

const modTextEnc = require("./textencoding.js");

const ENCODINGS = {
    0x01: "ISO 8859-5",  // Cyrillic
    0x02: "ISO 8859-6",  // Arabic
    0x03: "ISO 8859-7",  // Greek
    0x04: "ISO 8859-8",  // Hebrew
    0x05: "ISO 8859-9",  // Latin No. 5
    0x06: "ISO 8859-10", // Latin No. 6
    0x07: "ISO 8859-11", // Thai (draft)
    0x09: "ISO 8859-13", // Latin No. 7
    0x0a: "ISO 8859-14", // Latin No. 8 (Celtic)
    0x0b: "ISO 8859-15", // Latin No. 9
    0x11: "ISO 10646",   // Basic Multilingual Plane
    0x12: "KSX1001-2004", // Korean
    0x13: "GB-2312-1980", // Simplified Chinese
    0x14: "Big5",         // Traditional Chinese
    0x15: "UTF-8"
};




exports.EITParser = function EITParser()
{
    var m_pos = 0;
    var m_epg = { };

    this.parse = function(data)
    {
        m_pos = 0;
        m_epg = { };

        var ts = { };

        // TS has services has tables has events

        while (m_pos < data.length)
        {
            var section = readSection(data);
            
            if (! ts[section.tsId])
            {
                ts[section.tsId] = { };
            }

            var services = ts[section.tsId];
            if (! services[section.serviceId])
            {
                services[section.serviceId] = { };
            }

            var tables = services[section.serviceId];
            if (! tables[section.tableId])
            {
                tables[section.tableId] = { };
            }

            section.events.forEach(function (e) { tables[section.tableId][e.eventId] = e; });

            //return;
        }
        //console.log(JSON.stringify(ts, " ", 4));
        return ts;
    };

    /* Resolves a binary-coded decimal.
     */
    function bcd(value)
    {
        var h = (value & 0b11110000) >> 4;
        var l = value & 0b1111;
        return h * 10 + l;
    }

    /* Coverts a Modified Julian Date value to a (year, month, day) tuple.
     */
    function mjdToYmd(mjd)
    {
        var yd = Math.floor((mjd - 15078.2) / 365.25);
        var md = Math.floor((mjd - 14956.1 - Math.floor(yd * 365.25)) / 30.6001);
        var d = mjd - 14956 - Math.floor(yd * 365.25) - Math.floor(md * 30.6001);
        var k = md === 14 || md === 15 ? 1 : 0;
        var y = 1900 + yd + k;
        var m = md - 1 - k * 12;
        return [y, m, d];
    }

    /* Reads the given amount of (little-endian) bytes as an integer value.
     */
    function readBytes(data, n)
    {
        var value = 0;
        var mult = 8 * (n -1);
        for (var i = 0; i < n; ++i)
        {
            value += data[m_pos + i] << mult;
            mult -= 8;
        }
        m_pos += n;
        return value;
    }

    /* Reads the given amount of bytes as a string.
     */
    function readString(data, n)
    {
        var s = data.slice(m_pos, m_pos + n);
        m_pos += n;
        return s;
    }

    /* Reads the given amount of bytes as an encoded string.
     */
    function readEncoded(data, n)
    {
        return modTextEnc.decode(readString(data, n));
    }

    function readSection(data)
    {
        var tableId = readBytes(data, 1);
        var sectionLength = readBytes(data, 2) & 0b0000111111111111;
        var nextPos = m_pos + sectionLength;
        var serviceId = readBytes(data, 2);
        var versionNumber = (readBytes(data, 1) & 0b00111110) >> 1;
        var sectionNumber = readBytes(data, 1);
        var lastSectionNumber = readBytes(data, 1);
        var tsId = readBytes(data, 2);
        var originalNetworkId = readBytes(data, 2);
        var segmentLastSectionNumber = readBytes(data, 1);
        var lastTableId = readBytes(data, 1);

        //console.log("Table: " + tableId + " Service: " + serviceId + " TS: " + tsId + " Section: " + sectionNumber + " Last: " + lastSectionNumber);

        var events = [];
        while (m_pos + 4 < nextPos)
        {
            events.push(readEvent(data));
        }
        events.sort(function (a, b) { return a.id - b.id; });

        m_pos = nextPos;

        return {
            "tableId": tableId,
            "serviceId": serviceId,
            "section": sectionNumber,
            "tsId": tsId,
            "events": events
        };
    }

    function readEvent(data)
    {
        var eventId = readBytes(data, 2);
        var mjd = readBytes(data, 2);
        var ymd = mjdToYmd(mjd);
        var th = bcd(readBytes(data, 1));
        var tm = bcd(readBytes(data, 1));
        var ts = bcd(readBytes(data, 1));
        var dh = bcd(readBytes(data, 1));
        var dm = bcd(readBytes(data, 1));
        var ds = bcd(readBytes(data, 1));
        var duration = dh * 3600 + dm * 60 + ds;

        var statusEtc = readBytes(data, 2);
        var runningStatus = (statusEtc & 0b1110000000000000) >> 13;
        var scrambled = (statusEtc & 0b1000000000000) !== 0 ? true : false;

        var loopLength = statusEtc & 0b111111111111;
        var until = m_pos + loopLength;
        var descriptors = { };
        while (m_pos < until)
        {
            var obj = readDescriptor(data);
            if (! descriptors[obj.type])
            {
                descriptors[obj.type] = [];
            }
            descriptors[obj.type].push(obj);
        }

        var shortObj = (descriptors[0x4d] || [{ name: "<no information>", text: "" }])[0];
        var extendedObjs = descriptors[0x4e] || [];
        extendedObjs.sort(function (a, b) { return a.number  - b.number; });

        var startDate = Date.UTC(ymd[0], ymd[1] - 1 /* starts at 0 */, ymd[2], th, tm, ts, 0);

        return {
            "eventId": eventId,
            "status": statusEtc,
            "running": runningStatus,
            "scrambled": scrambled,
            "start": Math.floor(new Date(startDate).getTime() / 1000),
            "duration": duration,
            "short": shortObj,
            "extended": { "text": extendedObjs.reduce(function (t, a) { return t + a.text; }, "") }
        };
    }

    function readDescriptor(data)
    {
        var tag = readBytes(data, 1);
        var length = readBytes(data, 1);

        var pos = m_pos;

        switch (tag)
        {
        case 0x4d: // short_event_descriptor
            return readShortEventDescriptor(data);
        case 0x4e: // extended_event_descriptor
            return readExtendedEventDescriptor(data);
        }

        m_pos = pos + length;
        return { };
    }

    function readShortEventDescriptor(data)
    {
        var languageCode = readString(data, 3);
        var eventNameLength = readBytes(data, 1);
        var eventName = readEncoded(data, eventNameLength);
        var textLength = readBytes(data, 1);
        var text = readEncoded(data, textLength);

        return {
            "type": 0x4d,
            "language": languageCode.toString("ascii"),
            "name": eventName.toString("latin1"),
            "text": text.toString("latin1")
        };
    }

    function readExtendedEventDescriptor(data)
    {
        var descriptorNumbers = readBytes(data, 1);
        var descriptorNumber = (descriptorNumbers & 0b11110000) >> 4;
        var lastDescriptorNumber = descriptorNumbers & 0b1111;
        var languageCode = readString(data, 3);
        var lengthOfItems = readBytes(data, 1);
        var until = m_pos + lengthOfItems;

        while (m_pos < until)
        {
            var itemDescriptionLength = readBytes(data, 1);
            var itemDescription = readString(data, itemDescriptionLength);
            var itemLength = readBytes(data, 1);
            var item = readString(data, itemLength);
            //console.log("Item Description: " + itemDescription.toString("utf8") + " Item: " + item.toString("utf8"))
        }
        var textLength = readBytes(data, 1);
        var text = readEncoded(data, textLength);

        return {
            "type": 0x4e,
            "number": descriptorNumber,
            "lastNumber": lastDescriptorNumber,
            "language": languageCode.toString("ascii"),
            "text": text.toString("latin1")
        };
    }

    function readServiceDescriptor(data)
    {
        var pos = m_pos;
        var tag = readBytes(data, 1);
        var length = readBytes(data, 1);
        var serviceType = readBytes(data, 1);
        var providerNameLength = readBytes(data, 1);
        var providerName = data.slice(m_pos + 1, providerNameLength - 1);
        m_pos += providerNameLength;
        var serviceNameLength = readBytes(data, 1);
        var serviceName = data.slice(m_pos + 1, serviceNameLength - 1);
        m_pos += serviceNameLength;

        //console.log("Tag: " + tag + " Type: " + serviceType);
        //console.log("Provider: " + providerName.toString("utf8") + " Service: " + serviceName.toString("utf8"));

        return {
            "type": "service",
            "serviceType": serviceType,
            "provider": providerName,
            "service": serviceName
        };
    }
};

/*
var eitFile = modProcess.argv[2];
console.log("Opening " + eitFile);
var ts = new EITParser().parse(modFs.readFileSync(eitFile), "binary");
for (var key in ts)
{
    console.log("TS: " + key);
    for (var key2 in ts[key])
    {
        console.log("  Service: " + key2);
        for (var key3 in ts[key][key2])
        {
            console.log("    Table: " + key3);
            console.log("      Events: " + Object.keys(ts[key][key2][key3]).length);
        }
    }
}

[52006, 52146, 53518].forEach(function (serviceId)
{
    var events = ts[10000][serviceId][0x50];
    for (var eventId in events)
    {
        var event = events[eventId];
        console.log("Event ID: " + eventId);
        console.log("Start: " + event.start + ", duration: " + event.duration + " s");
        console.log("---")
        console.log("Short: " + event.short.name + ", " + event.short.text);
        console.log("Extended: " + event.extended.text);
        console.log("");
    }
});
*/
