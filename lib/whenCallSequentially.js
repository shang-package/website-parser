function whenCallSequentially(functionCalls) {

  var deferredResonse = Deferred();
  var resultData = [];

  // nothing to do
  if (functionCalls.length === 0) {
    return deferredResonse.resolve(resultData).promise();
  }

  var currentDeferred = functionCalls.shift()();
  // execute synchronous calls synchronously
  while (currentDeferred.state() === 'resolved') {
    currentDeferred.done(function (data) {
      resultData.push(data);
    });
    if (functionCalls.length === 0) {
      return deferredResonse.resolve(resultData).promise();
    }
    currentDeferred = functionCalls.shift()();
  }

  // handle async calls
  var interval = setInterval(function () {
    // handle mixed sync calls
    while (currentDeferred.state() === 'resolved') {
      currentDeferred.done(function (data) {
        resultData.push(data);
      });
      if (functionCalls.length === 0) {
        clearInterval(interval);
        deferredResonse.resolve(resultData);
        break;
      }
      currentDeferred = functionCalls.shift()();
    }
  }, 10);

  return deferredResonse.promise();
}

module.exports = whenCallSequentially;