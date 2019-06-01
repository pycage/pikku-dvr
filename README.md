# Pikku-DVR

*Copyright (c) 2019 Martin Grimme*

Just a tiny (finnish: pikku) digital video recorder for the Linux command line.

* The EPG (electronic programming guide) is updated automatically
* Browse the EPG and schedule recordings
* Get the recordings in MP4 format

## 1 Requirements

* Linux with a working setup of DVB-capturing hardware.
* bash (who doesn't have this?)
* DVB-related tools:
  * dvbv5-zap
  * dvbsnoop
* ffmpeg built with MP4 support
* nodejs

## 2 What's in the Box

* `config.example`: Example for a configuration file
* `pdvr`: The *Pikku-DVR* frontend
* `core`: Contains the various components that make up *Pikku-DVR*
* `README.md`: The README file you are currently reading

## 3 Setup

Copy the file `config.example` over to `config` and adjust its contents
to your needs. You may at least want to adjust the
path to your DVB `channels.conf` file in ZAP format (which you can create with `w_scan` for example).

## 4 Usage

Use the `pdvr` tool from the `pdvr` directory for working with the DVR.

### 4.1 Start the DVR Services

Use `pdvr start` to start the DVR services and run them in the background:

    # pdvr start
    [Running] Scheduler
    [Running] Converter
    [Running] EPG Updater

### 4.2 Stop the DVR Services

Use `pdvr stop` to stop the DVR services if they are running:

    # pdvr stop
    [Stopped] Scheduler
    [Stopped] Converter
    [Stopped] EPG Updater

### 4.3 Show the DVR Status

Use `pdvr status` to see status information about the DVR:

    # pdvr status
    [Running] Scheduler
    [Running] Converter
    [Running] EPG Updater
    
    [  Rec  ] Game Of Thrones - 2019-05-11 - S08E02 - A Knight of the Seven Kingdoms
              Until 23:30

    [Convert] Goblin Slayer - 2019-05-11 - S01E05

### 4.4 Schedule a Recording

Use `pdvr record` to schedule a recording, e.g.

    # pdvr record "10:30 pm" 3600 "RTL(Digital Free)" "Game Of Thrones" "S08E02 - A Knight of the Seven Kingdoms"

This line will schedule a recording at 10:30 pm the same day on the channel "RTL(Digital Free)"
to record the show "Game Of Thrones - S08E02 - A Knight of the Seven Kingdoms" for an hour (3600 seconds).

After the recording has finished, it will be converted to MP4 format and moved to your
records directory. Depending on your system, the conversion may take longer than the actual
recording.

### 4.5 Show the scheduled Recordings

Use `pdvr show` to show the scheduled recordings:

    # pdvr show
    [2019-05-11 22:30 - 23:30] Game Of Thrones - S08E02 - A Knight of the Seven Kingdoms (RTL(Digital Free))
    [2019-05-12 20:00 - 20:15] Tagesschau (ARD HD)

### 4.6 Browse the EPG

Use `pdvr epg` to browse the EPG and select shows for recording:

    # pdvr epg

This will open the EPG console interface.

Use the cursor keys to navigate channels and shows and press [R] to schedule a recording for the currently selected show.

