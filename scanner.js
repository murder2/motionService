"use strict";

const MotionSensorScanner = require('./MotionSensorScanner');
const http = require('request-promise');
let scanner;

let serverIpPort = process.argv[2] ? process.argv[2] : "127.0.0.1:8080";
let scannerName = process.argv[3] ? process.argv[3] : "name";

console.log(serverIpPort + "/" + scannerName);

function startScanner() {
    scanner = new MotionSensorScanner(serverIpPort, serverIpPort);
    scanner.scan();
}

function queryConf() {
	http({
		method: 'GET',
		uri: 'http://' + serverIpPort + '/sensors/' + scannerName
	}).then(function(body) {
		let json = JSON.parse(body);
		console.log(json);
		scanner.updateConf(json.beacons);
	}).catch(function (err){
		console.log(err);
		process.exit();
	})
}

startScanner();

http({
	method: 'POST',
	uri: 'http://' + serverIpPort + '/sensors/',
	json: {
		name: scannerName
	}
}).then(function (body){
	setInterval(queryConf, 10000);
}).catch(function (err){
	console.log(err);
	process.exit();
})