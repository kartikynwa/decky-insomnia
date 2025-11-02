local function send_message(message)
    local file = io.open("/tmp/decky_insomnia_fifo", "a")
    if file then
        file:write(message .. "\n")
        file:flush()
        file:close()
    end
end

if os.getenv("SteamDeck") == "1" then
    mp.register_event("start-file", function() send_message("inhibit") end)
    mp.register_event("end-file", function() send_message("restore") end)
end
