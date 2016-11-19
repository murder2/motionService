"use strict";

const spawn = require('child_process').spawn;
const exec = require('child_process').exec;
const http = require('request-promise');

function MotionSensorScanner(serverIpPort, myName) {
    this.scanner = null;
    this.buffer = "";
    this.minorWhitelist = {};
    this.majors = {};
    this.lasts = {};
    this.moving = {};

    this.updateConf = function(beacons) {
        for (var minor in this.moving) {
            if (this.moving.hasOwnProperty(minor)) {
                if (this.moving[minor]) {
                    this.sendEvent(minor, "stopped");
                }
            }
        }
        this.moving = {};
        this.majors = {};
        this.minorWhitelist = {};
        this.lasts = {};
        let beaconsNumber = beacons.length;
        for (var i = 0; i < beaconsNumber; i++) {
            this.addSensor(beacons[i].minor, beacons[i].major);
        }
    }

    this.addSensor = function(minor, major) {
        this.minorWhitelist[minor] = true;
        this.majors[minor] = major;
        this.lasts[minor] = 0;
        this.moving[minor] = false;
    }

    this.sendEvent = function (minor, event) {
        http({
            method: 'POST',
            uri: 'http://'+serverIpPort+'/sensors/'+myName+'/event',
            json: {
                major: this.majors[minor],
                minor: minor,
                extra: event
            }
        }).catch(function (err){
            console.log(err);
            process.exit();
        })
        console.log("(" + this.majors[minor] + "," + minor + ") " + event);
    }

    this.commitValue = function(minor) {
        if (this.moving[minor]) {
            this.sendEvent(minor, "moved");
        } else {
            this.sendEvent(minor, "stopped");
        }
    }

    this.scan = function() {
        exec("sudo pkill -f lescan; sudo pkill -f hcidump;", function(error, stdout, stderr) {
            if (error) {
                console.error("Cannot kill all lescan snd hcidump processes! " + error);
            }
        });
    
        exec('2>/dev/null 1>/dev/null sudo hcitool lescan --duplicates &', function(error, stdout, stderr) {
            if (error) {
                console.error("Error when running hcitool lescan: " + error);
                return;
            }
        });

        this.scanner = spawn('sudo', ['hcidump', '--raw']);
        this.scanner.stdout.on('data', this.newDataIn.bind(this));
        this.scanner.stderr.on('data', this.errorDataIn.bind(this));
        this.scanner.on('exit', this.handleExit.bind(this));
    }

    this.newDataIn = function(data) {
        data = this.buffer + data.toString();
        let packets = data.split(">");

        for (let j = 0; j < packets.length; j++) {
            if (packets[j]) {
                this.analysePacket(packets[j]);
            }
        }
    }

    this.analysePacket = function(packet) {
        packet = packet.replace(/\r?\n|\r/g, '').replace(/\s/g, '').replace(/>/g, '');
        // Detect EM beacon format
        if (packet.indexOf('0F09454D426561636F6E') === 28) {
            this.identifyEMDevice(packet);
        }
    }

    this.identifyEMDevice = function(packet) {
        let minor = packet.substr(48, 10);

        let minorStr = "";
        for (let i = 0; i < minor.length; i += 2) {
            minorStr += String.fromCharCode(parseInt(minor.substr(i, 2), 16));
        }

        minor  = parseInt(minorStr);
        if (this.minorWhitelist[minor]) {
            let sensorData = packet.substr(68, 4);
            let sensorType = sensorData[0];
            let sensorValue = 0;
            if (sensorType == 'B') {  
                let counterData = packet.substr(87, 3);
                let counter = parseInt(counterData, 16);
                let sensorStr = sensorData[1] + sensorData[2] + sensorData[3]
                let sensorInt = ((parseInt(sensorStr, 16) & 0xfc0) >> 6) | 0;
                if ((sensorInt & (1 << 5)) > 0) {
                    sensorInt = sensorInt - ((1 << 6) | 0);
                }
                let sensorFrac = ((parseInt(sensorStr, 16) & 0x3f) | 0)/64;
                sensorValue = sensorInt + sensorFrac;

                if (this.moving[minor]) {
                    if (sensorValue == this.lasts[minor]) {
                        this.moving[minor] = false;
                        this.commitValue(minor);
                    }
                } else {
                    let diff = sensorValue - this.lasts[minor];
                    if ((diff > 0 && diff  > 0.03125) || (diff < 0 && diff < -0.0625)) {
                        this.moving[minor] = true;
                        this.commitValue(minor);
                    }
                }

                this.lasts[minor] = sensorValue
            }
        }
    }

    this.errorDataIn = function(data) {
        console.log('Error', data);
    }

    this.handleExit = function() {
        if (this.onError) {
            this.onError();
        }
    }

    this.onError = null;
}

module.exports = MotionSensorScanner;