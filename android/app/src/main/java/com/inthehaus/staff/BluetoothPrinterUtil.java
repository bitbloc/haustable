package com.inthehaus.staff;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;
import androidx.core.app.ActivityCompat;
import java.io.IOException;
import java.io.OutputStream;
import java.util.UUID;

public class BluetoothPrinterUtil {

    private static final String TAG = "BluetoothPrinterUtil";
    // Standard UUID for SPP (Serial Port Profile)
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    public static void print(Context context, String textToPrint) {
        SharedPreferences prefs = context.getSharedPreferences(BluetoothSettingsActivity.PREFS_NAME, Context.MODE_PRIVATE);
        String printerAddress = prefs.getString(BluetoothSettingsActivity.PRINTER_ADDRESS, null);

        if (printerAddress == null) {
            Log.e(TAG, "No printer address saved.");
            return;
        }

        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
             if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Log.e(TAG, "Bluetooth connect permission not granted.");
                return;
             }
        }

        BluetoothAdapter bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
        BluetoothDevice printer = bluetoothAdapter.getRemoteDevice(printerAddress);
        BluetoothSocket socket = null;

        try {
            socket = printer.createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();
            OutputStream outputStream = socket.getOutputStream();
            // Add a newline character for the printer
            outputStream.write(textToPrint.getBytes());
            outputStream.write("\n\n".getBytes()); // Add some space after the print
            outputStream.flush();
            Log.d(TAG, "Successfully sent data to printer.");
        } catch (IOException e) {
            Log.e(TAG, "Error printing", e);
        } finally {
            if (socket != null) {
                try {
                    socket.close();
                } catch (IOException e) {
                    Log.e(TAG, "Error closing socket", e);
                }
            }
        }
    }
}
