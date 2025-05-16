# decky-insomnia

This decky plugin was borne out of frustration caused by the Steam Deck
trying to dim the screen or suspend in the absence of user input as I was watching
videos on mpv.

The plugin creates a named pipe at `/tmp/decky_insomnia_fifo` on loading. Sending `inhibit`
to this pipe sets all screen dimming and auto suspend timeouts to "Disabled". Sending
`restore` restores them to the values that are set in the plugin interface.

With this plugin enabled and mpv loaded with the [`dont_sleep.lua`](./mpv_script/dont_sleep.lua) script,
the timeouts will be disabled when a file is played and restored when playback stops.

### Credit

Thank you to [xfangfang/DeckyInhibitScreenSaver](https://github.com/xfangfang/DeckyInhibitScreenSaver) for
showing how to set the options using SteamClient. This repo was the only place I ever found which
contained this information. The code I use for updating settings is heavily borrowed from this repo.
