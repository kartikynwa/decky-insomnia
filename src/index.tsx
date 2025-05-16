import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  staticClasses,
  Dropdown,
  DropdownOption,
  SingleDropdownOption,
  Field,
} from "@decky/ui";
import {
  addEventListener,
  removeEventListener,
  definePlugin,
  toaster,
  callable,
} from "@decky/api"
import { useEffect, useState } from "react";
import { ImSleepy2 } from "react-icons/im"

function toast(message: string) {
  toaster.toast({
    title: "Insomnia",
    body: message,
    icon: <ImSleepy2 />,
    duration: 2000
  });
}

enum Timeout {
  BatteryDim = 1,
  AcDim,
  BatterySuspend,
  AcSuspend,
}

// Taken from https://github.com/xfangfang/DeckyInhibitScreenSaver
function generateDisplaySettingProtobuf(displaySetting: Timeout, value: number) {
  let buffer = new ArrayBuffer(5);
  let view = new DataView(buffer);
  view.setUint8(0, displaySetting << 3 | 5);
  view.setFloat32(1, value, true);
  let binary = '';
  let bytes = new Uint8Array(buffer);
  let len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return binary;
}

const DisableTimeouts = async () => {
  const G = generateDisplaySettingProtobuf;
  const displaySettings = window.btoa(
    G(Timeout.BatteryDim, 0)
    + G(Timeout.AcDim, 0)
    + G(Timeout.BatterySuspend, 0)
    + G(Timeout.AcSuspend, 0)
  )
  let response = await SteamClient.System.UpdateSettings(displaySettings);
  if (response.result == 1) {
    toast("Timeouts disabled");
  } else {
    toast("Timeout disabling failed!");
  }
}

const RestoreTimeouts = async () => {
  const settings = await Backend.getSettings();
  const G = generateDisplaySettingProtobuf;
  const displaySettings = window.btoa(
    G(Timeout.BatteryDim, settings.bat_dim_timeout)
    + G(Timeout.AcDim, settings.ac_dim_timeout)
    + G(Timeout.BatterySuspend, settings.bat_suspend_timeout)
    + G(Timeout.AcSuspend, settings.ac_suspend_timeout)
  )
  let response = await SteamClient.System.UpdateSettings(displaySettings);
  if (response.result == 1) {
    toast("Timeouts restored");
  } else {
    toast("Timeout restoration failed!");
  }
}

// SETTINGS DEFINED HERE
type PluginSettings = {
  bat_dim_timeout: number,
  bat_suspend_timeout: number,
  ac_dim_timeout: number,
  ac_suspend_timeout: number,
}

class Backend {
  static getSettings = callable<[], PluginSettings>("get_settings");
  static setSetting = callable<[string, number], void>("set_setting");
}

function SettingsPanel() {
  const [settings, setSettings] = useState<PluginSettings>({
    // Default settings
    bat_dim_timeout: 60 * 5,
    bat_suspend_timeout: 60 * 15,
    ac_dim_timeout: 60 * 5,
    ac_suspend_timeout: 60 * 60,
  });

  const fetchSettings = async () => {
    setSettings(await Backend.getSettings());
  };

  const updateSettings = async (key: string, timeout: number) => {
    await Backend.setSetting(key, timeout);
    await fetchSettings();
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const batteryOptions: DropdownOption[] = [
    { label: "Disabled", data: 0 },
    { label: "1 minute", data: 60 * 1 },
    { label: "5 minutes", data: 60 * 5 },
    { label: "10 minutes", data: 60 * 10 },
    { label: "15 minutes", data: 60 * 15 },
    { label: "20 minutes", data: 60 * 20 },
  ];
  const acOptions: DropdownOption[] = [
    ...batteryOptions,
    { label: "1 hour", data: 60 * 60 }
  ];

  const dropdownOnChange = (option: SingleDropdownOption, key: keyof PluginSettings) => {
    const timeout: number = settings[key];
    const newTimeout: number = option.data;
    if (newTimeout != timeout) {
      updateSettings(key, newTimeout);
    }
  };

  type DropdownFieldProps = {
    label: string,
    options: DropdownOption[],
    key: keyof PluginSettings,
  };

  const dropdownFields: DropdownFieldProps[] = [
    { label: "On battery, dim screen after:", options: batteryOptions, key: "bat_dim_timeout" },
    { label: "On battery, suspend after:", options: batteryOptions, key: "bat_suspend_timeout" },
    { label: "On AC, dim screen after:", options: acOptions, key: "ac_dim_timeout" },
    { label: "On AC, suspend after:", options: acOptions, key: "ac_suspend_timeout" },
  ];

  return (
    <PanelSection title="Default Timeouts">
      {dropdownFields.map(field => (
        <PanelSectionRow>
          <Field
            label={field.label}
            bottomSeparator="standard"
            childrenLayout="below"
          >
            <Dropdown
              rgOptions={field.options}
              selectedOption={settings[field.key]}
              strDefaultLabel="Select..."
              onChange={(option) => dropdownOnChange(option, field.key)}
            />
          </Field>
        </PanelSectionRow>
      ))}
    </PanelSection>
  );
}

function Content() {
  return (
    <PanelSection>

      <PanelSection title="Sleep Controls">
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={DisableTimeouts}
          >
            {"Inhibit Dim/Sleep"}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={RestoreTimeouts}
          >
            {"Restore Dim/Sleep"}
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>

      <SettingsPanel />

    </PanelSection>
  );
};

export default definePlugin(() => {
  const inhibitListener = addEventListener("inhibit", () => {
    DisableTimeouts();
  });
  const restoreListener = addEventListener("restore", () => {
    RestoreTimeouts();
  });

  return {
    // alwaysRender: true,
    // The name shown in various decky menus
    name: "Insomnia",
    // The element displayed at the top of your plugin's menu
    titleView: <div className={staticClasses.Title}>Insomnia</div>,
    // The content of your plugin's menu
    content: <Content />,
    // The icon displayed in the plugin list
    icon: <ImSleepy2 />,
    // The function triggered when your plugin unloads
    onDismount() {
      console.log("Unloading")
      removeEventListener("inhibit", inhibitListener);
      removeEventListener("restore", restoreListener);
    },
  };
});
