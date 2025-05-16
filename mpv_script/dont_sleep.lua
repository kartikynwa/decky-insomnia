local function send_message(message)
    local file = io.open("/tmp/decky_insomnia_fifo", "a")
    if file then
        file:write(message)
        file:flush()
        file:close()
    end
end

mp.register_event("start-file", function() send_message("inhibit\n") end)
mp.register_event("end-file", function() send_message("restore\n") end)
