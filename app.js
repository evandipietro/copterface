// Run this to receive a png image stream from your drone.

var arDrone = require('ar-drone');
var cv = require('opencv');
var http = require('http');
var fs = require('fs');

console.log('Connecting png stream ...');
var client = arDrone.createClient();
var pngStream = client.getPngStream();
var processingImage = false;
var lastPng;
var navData;
var flying = false;
var startTime = new Date().getTime();
var log = function(s) {
    var time = ((new Date().getTime() - startTime) / 1000).toFixed(2);

    console.log(time + " \t" + s);
};

client.config('control:altitude_max', 3000);
pngStream
    .on('error', console.log)
    .on('data', function(pngBuffer) {
        lastPng = pngBuffer;
    });


var foundFace = function() {
    client.animateLeds('blinkGreenRed', 5, 2);

    console.log('running away!');
    client.clockwise(1);
    setTimeout(function() {
        client.stop();
        client.front(0.1);
    }, 1000);

    setTimeout(function() {
        client.stop();
    }, 2000);
};

function flip() {
    client.animate('flipBehind', 1000);

    setTimeout(function() {
        console.log('stopping and going down');
        client.stop();
        client.land();
    }, 2000);
}

var detectFaces = function() {
    if (!flying) return;
    if ((!processingImage) && lastPng) {
        processingImage = true;
        cv.readImage(lastPng, function(err, im) {
            var opts = {};
            im.detectObject(cv.FACE_CASCADE, opts, function(err, faces) {

                    var biggestFace;

                    for (var k = 0; k < faces.length; k++) {
                        face = faces[k];

                        if (!biggestFace || biggestFace.width < face.width)
                            biggestFace = face;

                        //im.rectangle([face.x, face.y], [face.x + face.width, face.y + face.height], [0, 255, 0], 2);
                    }

                    if (biggestFace) {
                        foundFace();
                    }

                    processingImage = false;

                    //im.save('/tmp/salida.png');

                }, opts.scale, opts.neighbors, opts.min && opts.min[0],
                opts.min && opts.min[1]);

        });
    }
};

var faceInterval = setInterval(detectFaces, 150);

client.takeoff();
client.after(5000, function() {
    log("going up");
    this.up(1);
}).after(1000, function() {
    log("stopping");
    this.stop();
    flying = true;
});


client.after(30000, function() {
    flying = false;
    this.stop();
    this.land();
});

client.on('navdata', function(navdata) {
    navData = navdata;
});


var server = http.createServer(function(req, res) {
    if (!lastPng) {
        res.writeHead(503);
        res.end('Did not receive any png data yet.');
        return;
    }

    res.writeHead(200, {
        'Content-Type': 'image/png'
    });
    res.end(lastPng);
});

server.listen(8080, function() {
    console.log('Serving latest png on port 8080 ...');
});