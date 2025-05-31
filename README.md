# decky-insomnia

This decky plugin was borne out of frustration caused by the Steam Deck
trying to dim the screen or suspend in the absence of user input as I was watching
videos on mpv.

The plugin creates a named pipe at `/tmp/decky_insomnia_fifo` on loading. Sending `inhibit`
to this pipe sets all screen dimming and auto suspend timeouts to "Disabled". Sending
`restore` restores them to the values that are set in the plugin interface.

With this plugin enabled and mpv loaded with the [`dont_sleep.lua`](./mpv_script/dont_sleep.lua) script,
the timeouts will be disabled when a file is played and restored when playback stops.

## Deemed to be FAQs

### Why is this needed?

Steam Deck's game mode does not support whatever X11/Wayland/DBus protcols exist for applicans to
request inhibiting the screensaver. The only way to stop screen dimming and suspend is to either
disable the timeouts or constantly give user input to reset the timers.

### Why not just use the desktop mode?

As a g\*mer I feel more comfortable in game mode.

### Why named pipe?

I spent a lot of time considering various IPC techniques. I wanted something that could be implemented
with Python's standard library. The options I considered were--named pipes, socketserver, HTTP server.

I first thought socketserver would strike a good balance between simplicity and reliability. But I faced
issues with executing the IPC. Since I want to use this mainly with mpv (my beloved), I would need to
communicate with the server through its Lua API. But Lua does not have a way of doing this and the mpv
Flatpak sandbox did not have netcat. It had socat but I couldn't get it to work because of reasons I
can't recall. So I ended up giving up on this option.

HTTP server seemed overkill. I don't wanna run an HTTP server unless I have to. Plus I was confused by
the documentation for the `http.server` module. It seems like the module is designed to statically
serve files and folders and it wasn't clear to me if I needed to override that behaviour.

The named pipe option is simple. I faced problems with running it in async context because reading
the file is a blocking operation and with terminating the reading loop gracefully. I don't know what will
happen if the named pipe gets deleted while the plugin is running because right now I exit the loop by
sending an exit command to the named pipe. For some reason it's not possible to do a read with a timeout.
It's hacky.

### This sounds suspect.

Consider using [xfangfang/DeckyInhibitScreenSaver](https://github.com/xfangfang/DeckyInhibitScreenSaver).
I haven't used it so can't vouch for it but it is meant to solve the same problem in a different way.

## Credit

Thank you to [xfangfang/DeckyInhibitScreenSaver](https://github.com/xfangfang/DeckyInhibitScreenSaver) for
showing how to set the options using SteamClient. This repo was the only place I ever found which
contained this information. The code I use for updating settings is heavily borrowed from this repo.
