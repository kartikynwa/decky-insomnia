import os

# The decky plugin module is located at decky-loader/plugin
# For easy intellisense checkout the decky-loader code repo
# and add the `decky-loader/plugin/imports` path to `python.analysis.extraPaths` in `.vscode/settings.json`
import decky
import asyncio
from pathlib import Path

from settings import SettingsManager

settings_manager = SettingsManager(name="settings")
settings_manager.read()

default_settings = {
    "bat_dim_timeout": 60 * 5,
    "bat_suspend_timeout": 60 * 15,
    "ac_dim_timeout": 60 * 5,
    "ac_suspend_timeout": 60 * 60,
}

for k, v in default_settings.items():
    if k not in settings_manager.settings:
        settings_manager.settings[k] = v
    settings_manager.commit()


class Plugin:
    fifo_path = Path("/tmp/decky_insomnia_fifo")
    should_exit = False

    def ensure_fifo_exists(self):
        if not self.fifo_path.is_fifo():
            decky.logger.info(f"Creating fifo at {self.fifo_path}")
            os.mkfifo(self.fifo_path)
            decky.logger.info(f"Created fifo at {self.fifo_path}")
        else:
            decky.logger.info(f"Fifo already exists at {self.fifo_path}")

    async def start_listening(self):
        while not self.should_exit:
            decky.logger.info(f"Waiting for message at {self.fifo_path}")
            message = await asyncio.to_thread(self.fifo_path.read_text)
            message = message.lower().strip()
            if message == "inhibit" or message == "restore":
                decky.logger.info(f"Updating sleep settings: {message}")
                await decky.emit(message)
            elif message == "exit":
                decky.logger.info(f"Exiting. Received: {message}")
                break
            else:
                decky.logger.info(f"Unknown message: {message}")

    def stop_listening(self):
        decky.logger.info("Exiting")
        self.should_exit = True
        self.fifo_path.write_text("exit")
        self.fifo_path.unlink()
        decky.logger.info("Exited")

    # Asyncio-compatible long-running code, executed in a task when the plugin is loaded
    async def _main(self):
        decky.logger.info("Starting _main()")
        self.ensure_fifo_exists()
        try:
            await self.start_listening()
        except asyncio.exceptions.CancelledError:
            self.stop_listening()

    async def get_settings(self):
        decky.logger.debug(f"Backend is sending settings: {settings_manager.settings}")
        return settings_manager.settings

    async def set_setting(self, key: str, timeout: int):
        decky.logger.debug(f"Backend is setting setting: {key=}, {timeout=}")
        settings_manager.setSetting(key, timeout)

    # Function called first during the unload process, utilize this to handle your plugin being stopped, but not
    # completely removed
    async def _unload(self):
        if self.fifo_path.is_fifo():
            self.stop_listening()
        decky.logger.info("Done _unload()")

    # Function called after `_unload` during uninstall, utilize this to clean up processes and other remnants of your
    # plugin that may remain on the system
    async def _uninstall(self):
        decky.logger.info("Done _uninstall()")

    # Migrations that should be performed before entering `_main()`.
    async def _migration(self):
        decky.logger.info("Migrating")
        # Here's a migration example for logs:
        # - `~/.config/decky-template/template.log` will be migrated to `decky.decky_LOG_DIR/template.log`
        decky.migrate_logs(
            os.path.join(
                decky.DECKY_USER_HOME, ".config", "decky-template", "template.log"
            )
        )
        # Here's a migration example for settings:
        # - `~/homebrew/settings/template.json` is migrated to `decky.decky_SETTINGS_DIR/template.json`
        # - `~/.config/decky-template/` all files and directories under this root are migrated to `decky.decky_SETTINGS_DIR/`
        decky.migrate_settings(
            os.path.join(decky.DECKY_HOME, "settings", "template.json"),
            os.path.join(decky.DECKY_USER_HOME, ".config", "decky-template"),
        )
        # Here's a migration example for runtime data:
        # - `~/homebrew/template/` all files and directories under this root are migrated to `decky.decky_RUNTIME_DIR/`
        # - `~/.local/share/decky-template/` all files and directories under this root are migrated to `decky.decky_RUNTIME_DIR/`
        decky.migrate_runtime(
            os.path.join(decky.DECKY_HOME, "template"),
            os.path.join(decky.DECKY_USER_HOME, ".local", "share", "decky-template"),
        )
