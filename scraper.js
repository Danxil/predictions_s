var cheerio = require('cheerio');
var webdriverio = require('webdriverio');
var MongoClient = require('mongodb').MongoClient;

const OPTIONS = {
  desiredCapabilities: {
    browserName: 'chrome'
  }
};

// Connection URL
const URL_DB = 'mongodb://localhost:27017/predictions_s';

const URL_ARR = [
  'http://www.oddsportal.com/soccer/africa/africa-cup-of-nations-2013/results/#/page/1/',
  'http://www.oddsportal.com/soccer/africa/africa-cup-of-nations-2013/results/#/page/2/'
]

function pageCrawl(client, url) {
  return setClientUrl(client, url).then(()=> {
    var teams = client.getText('.name.table-participant a');
    var results = client.getText('td.center.bold.table-odds.table-score');

    return Promise.all([teams, results]);
  }).then((result)=> {
    var teams = result[0];
    var results = result[1];

    return results.map((item, index)=> {
      return {
        teams: teams[index],
        result: results[index],
      }
    })
  });
}

function setClientUrl(client, url) {
  return client.url(url).then(()=> {
    return client.refresh();
  });
}

function iteration(db, client, index = 0) {
  return pageCrawl(client, URL_ARR[index]).then((results)=> {
    return addResultsToDB(db, results);
  }).then(()=> {
    index++;

    if (index < URL_ARR.length) {
      return iteration(db, client, index);
    }
  });
};

function addResultsToDB(db, results) {
  return new Promise((resolve, reject)=> {
    var collection = db.collection('results');

    collection.insertMany(results, {ordered: false}, function(error, result) {
      if (error) {

        reject(error);
      }
      
      resolve();
    });
  });
}


MongoClient.connect(URL_DB, function(err, db) {
  if (err) {
    throw new Error(err);
  }

  console.log("Connected successfully to server");

  var client = webdriverio
    .remote(OPTIONS)
    .init();

  var collection = db.collection('results').drop();

  iteration(db, client).then(()=> {
    client.end();
    db.close();
  }).catch((error)=> {
    throw new Error(error);
  });

});
