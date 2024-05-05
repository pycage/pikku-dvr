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

/* Resolves a binary-coded decimal.
 */
function bcd(value)
{
    const h = (value & 0b11110000) >> 4;
    const l = value & 0b1111;
    return h * 10 + l;
}

/* Coverts a Modified Julian Date value to a (year, month, day) tuple.
 */
function mjdToYmd(mjd)
{
    const yd = Math.floor((mjd - 15078.2) / 365.25);
    const md = Math.floor((mjd - 14956.1 - Math.floor(yd * 365.25)) / 30.6001);
    const d = mjd - 14956 - Math.floor(yd * 365.25) - Math.floor(md * 30.6001);
    const k = md === 14 || md === 15 ? 1 : 0;
    const y = 1900 + yd + k;
    const m = md - 1 - k * 12;
    return [y, m, d];
}


class EITParser
{
    constructor()
    {
        this.m_pos = 0;
        this.m_epg = { };
    }

    /* Reads the given amount of (little-endian) bytes as an integer value.
     */
    readBytes(data, n)
    {
        let value = 0;
        let mult = 8 * (n -1);
        for (let i = 0; i < n; ++i)
        {
            value += data[this.m_pos + i] << mult;
            mult -= 8;
        }
        this.m_pos += n;
        return value;
    }

    /* Reads the given amount of bytes as a string.
     */
    readString(data, n)
    {
        const s = data.slice(this.m_pos, this.m_pos + n);
        this.m_pos += n;
        return s;
    }

    /* Reads the given amount of bytes as an encoded string.
     */
    readEncoded(data, n)
    {
        return modTextEnc.decode(this.readString(data, n));
    }

    readSection(data)
    {
        const tableId = this.readBytes(data, 1);
        const sectionLength = this.readBytes(data, 2) & 0b0000111111111111;
        const nextPos = this.m_pos + sectionLength;
        const serviceId = this.readBytes(data, 2);
        const versionNumber = (this.readBytes(data, 1) & 0b00111110) >> 1;
        const sectionNumber = this.readBytes(data, 1);
        const lastSectionNumber = this.readBytes(data, 1);
        const tsId = this.readBytes(data, 2);
        const originalNetworkId = this.readBytes(data, 2);
        const segmentLastSectionNumber = this.readBytes(data, 1);
        const lastTableId = this.readBytes(data, 1);

        //console.log("Table: " + tableId + " Service: " + serviceId + " TS: " + tsId + " Section: " + sectionNumber + " Last: " + lastSectionNumber);

        const events = [];
        while (this.m_pos + 4 < nextPos)
        {
            events.push(this.readEvent(data));
        }
        events.sort((a, b) => a.id - b.id);

        this.m_pos = nextPos;

        return {
            "tableId": tableId,
            "serviceId": serviceId,
            "section": sectionNumber,
            "tsId": tsId,
            "events": events
        };
    }

    readEvent(data)
    {
        const eventId = this.readBytes(data, 2);
        const mjd = this.readBytes(data, 2);
        const ymd = mjdToYmd(mjd);
        const th = bcd(this.readBytes(data, 1));
        const tm = bcd(this.readBytes(data, 1));
        const ts = bcd(this.readBytes(data, 1));
        const dh = bcd(this.readBytes(data, 1));
        const dm = bcd(this.readBytes(data, 1));
        const ds = bcd(this.readBytes(data, 1));
        const duration = dh * 3600 + dm * 60 + ds;

        const statusEtc = this.readBytes(data, 2);
        const runningStatus = (statusEtc & 0b1110000000000000) >> 13;
        const scrambled = (statusEtc & 0b1000000000000) !== 0 ? true : false;

        const loopLength = statusEtc & 0b111111111111;
        const until = this.m_pos + loopLength;
        const descriptors = { };
        while (this.m_pos < until)
        {
            const obj = this.readDescriptor(data);
            if (! descriptors[obj.type])
            {
                descriptors[obj.type] = [];
            }
            descriptors[obj.type].push(obj);
        }

        const shortObj = (descriptors[0x4d] || [{ name: "<no information>", text: "" }])[0];
        const extendedObjs = descriptors[0x4e] || [];
        extendedObjs.sort((a, b) => a.number  - b.number);

        const startDate = Date.UTC(ymd[0], ymd[1] - 1 /* starts at 0 */, ymd[2], th, tm, ts, 0);

        return {
            "eventId": eventId,
            "status": statusEtc,
            "running": runningStatus,
            "scrambled": scrambled,
            "start": Math.floor(new Date(startDate).getTime() / 1000),
            "duration": duration,
            "short": shortObj,
            "extended": { "text": extendedObjs.reduce((t, a) => t + a.text, "") }
        };
    }

    readDescriptor(data)
    {
        const tag = this.readBytes(data, 1);
        const length = this.readBytes(data, 1);

        const pos = this.m_pos;

        switch (tag)
        {
        case 0x4d: // short_event_descriptor
            return this.readShortEventDescriptor(data);
        case 0x4e: // extended_event_descriptor
            return this.readExtendedEventDescriptor(data);
        }

        this.m_pos = pos + length;
        return { };
    }

    readShortEventDescriptor(data)
    {
        const languageCode = this.readString(data, 3);
        const eventNameLength = this.readBytes(data, 1);
        const eventName = this.readEncoded(data, eventNameLength);
        const textLength = this.readBytes(data, 1);
        const text = this.readEncoded(data, textLength);

        return {
            "type": 0x4d,
            "language": languageCode.toString("ascii"),
            "name": eventName.toString("latin1"),
            "text": text.toString("latin1")
        };
    }

    readExtendedEventDescriptor(data)
    {
        const descriptorNumbers = this.readBytes(data, 1);
        const descriptorNumber = (descriptorNumbers & 0b11110000) >> 4;
        const lastDescriptorNumber = descriptorNumbers & 0b1111;
        const languageCode = this.readString(data, 3);
        const lengthOfItems = this.readBytes(data, 1);
        const until = this.m_pos + lengthOfItems;

        while (this.m_pos < until)
        {
            const itemDescriptionLength = this.readBytes(data, 1);
            const itemDescription = this.readString(data, itemDescriptionLength);
            const itemLength = this.readBytes(data, 1);
            const item = this.readString(data, itemLength);
            //console.log("Item Description: " + itemDescription.toString("utf8") + " Item: " + item.toString("utf8"))
        }
        const textLength = this.readBytes(data, 1);
        const text = this.readEncoded(data, textLength);

        return {
            "type": 0x4e,
            "number": descriptorNumber,
            "lastNumber": lastDescriptorNumber,
            "language": languageCode.toString("ascii"),
            "text": text.toString("latin1")
        };
    }

    readServiceDescriptor(data)
    {
        const pos = this.m_pos;
        const tag = this.readBytes(data, 1);
        const length = this.readBytes(data, 1);
        const serviceType = this.readBytes(data, 1);
        const providerNameLength = this.readBytes(data, 1);
        const providerName = data.slice(this.m_pos + 1, providerNameLength - 1);
        this.m_pos += providerNameLength;
        const serviceNameLength = this.readBytes(data, 1);
        const serviceName = data.slice(this.m_pos + 1, serviceNameLength - 1);
        this.m_pos += serviceNameLength;

        //console.log("Tag: " + tag + " Type: " + serviceType);
        //console.log("Provider: " + providerName.toString("utf8") + " Service: " + serviceName.toString("utf8"));

        return {
            "type": "service",
            "serviceType": serviceType,
            "provider": providerName,
            "service": serviceName
        };
    }

    parse(data)
    {
        this.m_pos = 0;
        this.m_epg = { };

        const ts = { };

        // TS has services has tables has events

        while (this.m_pos < data.length)
        {
            const section = this.readSection(data);
            
            if (! ts[section.tsId])
            {
                ts[section.tsId] = { };
            }

            const services = ts[section.tsId];
            if (! services[section.serviceId])
            {
                services[section.serviceId] = { };
            }

            const tables = services[section.serviceId];
            if (! tables[section.tableId])
            {
                tables[section.tableId] = { };
            }

            section.events.forEach(e => { tables[section.tableId][e.eventId] = e; });

            //return;
        }
        //console.log(JSON.stringify(ts, " ", 4));
        return ts;
    };
}
exports.EITParser = EITParser;


/*
const eitFile = modProcess.argv[2];
console.log("Opening " + eitFile);
const ts = new EITParser().parse(modFs.readFileSync(eitFile), "binary");
for (let key in ts)
{
    console.log("TS: " + key);
    for (let key2 in ts[key])
    {
        console.log("  Service: " + key2);
        for (let key3 in ts[key][key2])
        {
            console.log("    Table: " + key3);
            console.log("      Events: " + Object.keys(ts[key][key2][key3]).length);
        }
    }
}

[2820].forEach(serviceId =>
{
    const events = ts[65534][serviceId][0x50];
    for (let eventId in events)
    {
        const event = events[eventId];
        console.log("Event ID: " + eventId);
        console.log("Start: " + event.start + ", duration: " + event.duration + " s");
        console.log("---")
        console.log("Short: " + event.short.name + ", " + event.short.text);
        console.log("Extended: " + event.extended.text);
        console.log("");
    }
});
*/
