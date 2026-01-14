package com.inthehaus.staff;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import java.util.ArrayList;
import java.util.Set;

public class BluetoothSettingsActivity extends AppCompatActivity {

    private BluetoothAdapter bluetoothAdapter;
    private ArrayAdapter<String> pairedDevicesArrayAdapter;
    private ArrayList<BluetoothDevice> pairedDeviceList = new ArrayList<>();
    private ArrayList<String> deviceList = new ArrayList<>();
    private static final int REQUEST_ENABLE_BT = 1;
    public static final String PRINTER_ADDRESS = "printer_address";
    public static final String PREFS_NAME = "PrinterSettings";


    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_bluetooth_settings);

        ListView pairedListView = findViewById(R.id.paired_devices_list);
        pairedDevicesArrayAdapter = new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, deviceList);
        pairedListView.setAdapter(pairedDevicesArrayAdapter);

        pairedListView.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                if(pairedDeviceList.size() > 0) {
                    BluetoothDevice device = pairedDeviceList.get(position);
                    savePrinterAddress(device.getAddress());
                    Toast.makeText(BluetoothSettingsActivity.this, "Saved printer: " + device.getName(), Toast.LENGTH_SHORT).show();
                    finish();
                }
            }
        });

        Button scanButton = findViewById(R.id.scan_button);
        scanButton.setOnClickListener(v -> Toast.makeText(this, "Scan feature not implemented yet.", Toast.LENGTH_SHORT).show());

        bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
        if (bluetoothAdapter == null) {
            Toast.makeText(this, "Bluetooth not supported on this device", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        listPairedDevices();
    }

    private void listPairedDevices() {
        if (checkBluetoothPermissions()) {
             if (!bluetoothAdapter.isEnabled()) {
                Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
                startActivityForResult(enableBtIntent, REQUEST_ENABLE_BT);
                return;
            }
            Set<BluetoothDevice> pairedDevices = bluetoothAdapter.getBondedDevices();
            deviceList.clear();
            pairedDeviceList.clear();

            if (pairedDevices.size() > 0) {
                for (BluetoothDevice device : pairedDevices) {
                    pairedDeviceList.add(device);
                    deviceList.add(device.getName() + "\n" + device.getAddress());
                }
            } else {
                String noDevices = "No paired devices found.";
                deviceList.add(noDevices);
            }
            pairedDevicesArrayAdapter.notifyDataSetChanged();
        }
    }

    private void savePrinterAddress(String address) {
        SharedPreferences settings = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = settings.edit();
        editor.putString(PRINTER_ADDRESS, address);
        editor.apply();
    }


    private boolean checkBluetoothPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT}, 101);
                return false;
            }
        } else {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.BLUETOOTH}, 102);
                 return false;
            }
        }
        return true;
    }

     @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if(requestCode == REQUEST_ENABLE_BT && resultCode == RESULT_OK) {
            listPairedDevices();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            listPairedDevices();
        } else {
            Toast.makeText(this, "Bluetooth permission is required", Toast.LENGTH_SHORT).show();
        }
    }
}
