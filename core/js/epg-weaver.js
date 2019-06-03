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
    var result = { "version": 2, "services": { } };

    for (var service in epg)
    {
        for (var table in epg[service])
        {
            for (var event in epg[service][table])
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


var epgPath = modProcess.argv[2];
if (! epgPath)
{
    console.error("Usage: node epg-weaver.js <EPG path>");
    process.exit(1);
}

var epgFile = modPath.join(epgPath, "epg.json");
var epg = modFs.existsSync(epgFile) ? JSON.parse(modFs.readFileSync(epgFile))
                                    : { };
var now = new Date().getTime() / 1000;

if (getVersion(epg) < 2)
{
    epg = updateToVersion2(epg);
}

modFs.readdirSync(epgPath).forEach(function (file)
{
    if (! file.endsWith(".eit"))
    {
        return;
    }
    
    //console.log("Collecting EIT data from " + file + ".");
    var eit = new modEit.EITParser().parse(modFs.readFileSync(modPath.join(epgPath, file)));

    for (var ts in eit)
    {
        for (var service in eit[ts])
        {
            if (! epg.services[service])
            {
                epg.services[service] = { };
            }
            for (var table in eit[ts][service])
            {
                for (var event in eit[ts][service][table])
                {
                    epg.services[service][event] = eit[ts][service][table][event];
                }

            }

            // remove outdated events from this service
            for (event in epg.services[service])
            {
                var evObj = epg.services[service][event];
                if (evObj)
                {
                    var evEnd = evObj.start + evObj.duration;
                    if (evEnd <= now)
                    {
                        delete epg.services[service][event];
                    }
                }
            }
        }
    }
});

var servicesAmount = 0;
var eventsAmount = 0;
for (var service in epg.services)
{
    ++servicesAmount;

    for (var event in epg.services[service])
    {
        ++eventsAmount;
    }
}
console.log("Found " + eventsAmount + " events in " + servicesAmount + " channels.");
modFs.writeFileSync(epgFile + ".partial", JSON.stringify(epg, " ", 4));
modFs.renameSync(epgFile + ".partial", epgFile);
