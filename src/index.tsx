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
  BatterySuspend = 24003,
  AcSuspend,
}

enum WireType {
  Int32 = 0,
  Float = 5,
}

// LLM generated
/**
 * Encodes a key-value pair into a Protobuf Base64 string.
 * Supports int32 and float types.
 */
function generateProtobufMessage(key: number, value: number, wireType: WireType): string {
  const bytes = [];

  // Helper: Write Varint (Used for Tags and Int Values)
  // Writes 7 bits at a time, Little Endian order
  const writeVarint = (val: number) => {
    let n = BigInt(val);
    while (n > 127n) {
      bytes.push(Number((n & 0x7Fn) | 0x80n));
      n >>= 7n;
    }
    bytes.push(Number(n));
  };

  if (wireType === WireType.Float) {
    // --- FLOAT ENCODING ---
    // 1. Encode Tag
    // Wire Type for 32-bit (float) is 5
    const tag = (key << 3) | wireType;
    writeVarint(tag);

    // 2. Encode Value (Fixed 4 bytes, Little Endian)
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    // setFloat32(offset, value, isLittleEndian)
    view.setFloat32(0, value, true); 

    // Extract bytes
    for (let i = 0; i < 4; i++) {
      bytes.push(view.getUint8(i));
    }

  } else {
    // --- INT ENCODING ---
    // 1. Encode Tag
    // Wire Type for Varint (int32) is 0
    const tag = (key << 3) | wireType;
    writeVarint(tag);

    // 2. Encode Value (Varint)
    writeVarint(value);
  }

  return String.fromCharCode(...bytes);
}

// Steam seems to be using two different ways of updating settings at the moment.
// Messages of type CMsgSystemManagerSettings are sent to SteamClient.System.UpdateSettings.
// Messages of type CMsgCLientSettings are sent to SteamClient.Settings.SetSetting.
// https://github.com/SteamDatabase/Protobufs/blob/2a9529a/webui/common.proto#L1093

const DisableTimeouts = async () => {
  const G = generateProtobufMessage;
  let displaySettings = window.btoa(
    G(Timeout.BatterySuspend, 0, WireType.Int32)
    + G(Timeout.AcSuspend, 0, WireType.Int32)
  );
  await SteamClient.Settings.SetSetting(displaySettings);
  displaySettings = window.btoa(
    G(Timeout.BatteryDim, 0, WireType.Float)
    + G(Timeout.AcDim, 0, WireType.Float)
  );
  let response = await SteamClient.System.UpdateSettings(displaySettings);
  if (response.result == 1) {
    toast("Timeouts disabled");
  } else {
    toast("Timeout disabling failed!");
  }
}

const RestoreTimeouts = async () => {
  const settings = await Backend.getSettings();
  const G = generateProtobufMessage;
  let displaySettings = window.btoa(
    G(Timeout.BatterySuspend, settings.bat_suspend_timeout, WireType.Int32)
    + G(Timeout.AcSuspend, settings.ac_suspend_timeout, WireType.Int32)
  );
  SteamClient.Settings.SetSetting(displaySettings);
  displaySettings = window.btoa(
    G(Timeout.BatteryDim, settings.bat_dim_timeout, WireType.Float)
    + G(Timeout.AcDim, settings.ac_dim_timeout, WireType.Float)
  );
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
