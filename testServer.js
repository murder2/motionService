"use strict";
const express = require("express");
const bodyParser = require('body-parser');
let server = express();
server.use(bodyParser.json());
server.use(bodyParser.urlencoded({ extended: true }));

server.post('/sensors', function(req, res) {
	console.log(req.body);
	if (req.body.name == 'name') {
		res.send("OK");
	} else {
		console.log(req.body);
		res.status(400);
		res.send("Oops");
	}
});

server.get('/sensors/name', function(req, res) {
	res.send(JSON.stringify({
		beacons: [{
			major: 12,
			minor: 12,
			UID: 44
		},
		{
			major: 30,
			minor: 42,
			UID: 123123
		}
		]
	}));
});

server.post('/sensors/name/event', function(req, res) {
	console.log(req.body);
	res.send("OK");
});

server.listen(8080);