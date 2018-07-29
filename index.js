var https = require('https');
var http = require('http');
var fs = require('fs');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(':memory:');
app.use(express.json());
// error messages or other constants
var err500 = "Internal Server Error: Please try again later";
var HashMap = require('hashmap');
//var moment = require('moment');
// 8090 is to test locally
//https://www.betterfencer.com/articles/national-tournament-structure
//used example: https://stackoverflow.com/questions/49593250/send-excel-file-data-to-node-js-server-and-parse-it-into-json
var port = process.env.PORT || 8090;
var lastupload;
var counter =0;
var multer  = require('multer')
var XLSX = require('xlsx');
var async = require("async");

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './tmp')
  },
  filename: function (req, file, cb) {
    lastupload = "upload"+counter+".xlsx"
    counter++;
    cb(null, lastupload)
  }
})

var upload = multer({ storage: storage })

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
var server = http.createServer(app).listen(port, function() {
    //create db file locally if it doesn't exist
    console.log("Server listening on port "+port);
    
});
app.get('/', function(req, res) {
    fs.readFile('index.html', 'utf8', function (err,data) {
    if (err) {
        return console.log(err);
    }
        //console.log(data);
        res.write(data)
    });
});

app.post("/sendFile",  upload.single('fileName'), function(req, res){

    //text fields
    console.log(req.body);

    //file contents
   // console.log(req.file);

    //https://github.com/SheetJS/js-xlsx/issues/270
    // process
    
    var wb = XLSX.readFile("./tmp/"+lastupload);
    var ws = wb.Sheets.Sheet1;
    var jsonarray = XLSX.utils.sheet_to_json(wb.Sheets.Sheet1, {header:1});
    db.serialize(function() {
        db.run("CREATE TABLE if not exists localdb (name TEXT NOT NULL, ts INT NOT NULL,tr INT NOT NULL,ind INT NOT NULL,winpercentage INT NOT NULL, tiebreaker INT NOT NULL)");
        var stmt = db.prepare("INSERT INTO localdb VALUES (?,?,?,?,?,?)");
        
        async.forEachOf(jsonarray, function (entry, key, callback) {
                console.log(entry)
              //  console.log(entry[0]);
               var winpercentage = entry[1]/req.body.size;
                var ts = entry[2];
                var tr = entry[3];
                var ind = ts-tr;
                stmt.run([entry[0],ts,tr,ind,winpercentage,getRandomInt(0,Number.MAX_SAFE_INTEGER)], function(err){
                    if(err){
                        console.log(err);
                    }
                    callback();
                });
            
        }, function (err) {
            if (err) console.error(err.message);
            //console.log("DONE?");
            var getstmt = db.prepare("SELECT * from localdb ORDER BY winpercentage DESC, ind DESC, ts DESC,tiebreaker DESC");
            var responsejson = {};
            var seedings = new HashMap();
            var count = 1;
            getstmt.each(function(err,row){
                if(err){
                    responsejson["error"] = err500;
                    res.status(500).json();
                }else{
                    //res.json(row);
                    console.log(count +" "+row);
                    seedings.set(count,row);
                    console.log(seedings.get(count));
                    count= count+1;
                }
            }, function(err, rows) {
                console.log("done?");
                var responsejson = [];
                var roundnum = req.body.round;
                console.log("ROUND NUMBER "+ roundnum);
                var ranknum = 1;
                var total = seedings.size;
                
                while(seedings.size>0&&ranknum<total){
                    var bracket = {};
                    console.log("BRACKET NUMBER "+ranknum);
                    var topush1 = seedings.has(ranknum) ? seedings.get(ranknum) : "BY";
                    var topush2 = seedings.has(roundnum) ? seedings.get(roundnum) : "BY";
                    bracket[ranknum] =topush1;
                    bracket[roundnum] =topush2;
                    ranknum = ranknum +1;
                    roundnum = roundnum -1;
                    responsejson.push(bracket);
                    /**
                    console.log("ranknum " +ranknum);
                    console.log("roundnum " +roundnum);
                    
                    
                    console.log(topush1);
                    console.log(topush2);
                    responsejson.push(topush1);
                    responsejson.push(topush2);
                    ranknum++;
                    roundnum--;
                    if(seedings.has(ranknum)){
                        seedings.delete(ranknum);
                    }
                    if(seedings.has(roundnum)){
                        seedings.delete(roundnum);
                    }
                    **/
                }
                res.json(responsejson);
            });
            
            /**
            db.run("DELETE FROM localdb", function(err){
               if(err){
                    console.log(err);
                }
           });
           **/
        });
   
    });
    /**
    
        // integer, float and boolean can be handled by REAL
        
        
        res.json(response);
        
    
    **/
    
});
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
app.on('close', function () {
  console.log("Closed");
  db.close();
});