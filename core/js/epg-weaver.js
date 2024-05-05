"use strict";

const modFs = require("fs"),
      modPath = require("path"),
      modProcess = require("process");

const modEit = require("./eitparser.js");


function getVersion(epg)
{
    return epg.version === undefined ? 1 : 2;
}

function updateToVersion2(epg)
{
    const result = { "version": 2, "services": { } };

    for (let service in epg)
    {
        for (let table in epg[service])
        {
            for (let event in epg[service][table])
            {
                if (! result.services[service])
                {
                    result.services[service] = { };
                }
                result.services[service][event] = epg[service][table][event];
            }
        }
    }
    return result;
}


const epgPath = modProcess.argv[2];
if (! epgPath)
{
    console.error("Usage: node epg-weaver.js <EPG path>");
    process.exit(1);
}

const epgFile = modPath.join(epgPath, "epg.json");
let epg = modFs.existsSync(epgFile) ? JSON.parse(modFs.readFileSync(epgFile))
                                    : { };
const now = new Date().getTime() / 1000;

if (getVersion(epg) < 2)
{
    epg = updateToVersion2(epg);
}

modFs.readdirSync(epgPath).forEach(file =>
{
    if (! file.endsWith(".eit"))
    {
        return;
    }
    
    //console.log("Collecting EIT data from " + file + ".");
    const eit = new modEit.EITParser().parse(modFs.readFileSync(modPath.join(epgPath, file)));

    for (let ts in eit)
    {
        for (let service in eit[ts])
        {
            if (! epg.services[service])
            {
                epg.services[service] = { };
            }
            for (let table in eit[ts][service])
            {
                for (let event in eit[ts][service][table])
                {
                    epg.services[service][event] = eit[ts][service][table][event];
                }

            }

            // remove outdated events from this service
            for (let event in epg.services[service])
            {
                const evObj = epg.services[service][event];
                if (evObj)
                {
                    const evEnd = evObj.start + evObj.duration;
                    if (evEnd <= now)
                    {
                        delete epg.services[service][event];
                    }
                }
            }
        }
    }
});

let servicesAmount = 0;
let eventsAmount = 0;
for (let service in epg.services)
{
    ++servicesAmount;

    for (let event in epg.services[service])
    {
        ++eventsAmount;
    }
}
console.log("Found " + eventsAmount + " events in " + servicesAmount + " channels.");
modFs.writeFileSync(epgFile + ".partial", JSON.stringify(epg, " ", 4));
modFs.renameSync(epgFile + ".partial", epgFile);
