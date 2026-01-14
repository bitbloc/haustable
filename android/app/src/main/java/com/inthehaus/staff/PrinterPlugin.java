package com.inthehaus.staff;

import android.content.Intent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Printer")
public class PrinterPlugin extends Plugin {

    @PluginMethod()
    public void openBluetoothSettings(PluginCall call) {
        Intent intent = new Intent(getContext(), BluetoothSettingsActivity.class);
        getActivity().startActivity(intent);
        call.resolve();
    }
}
