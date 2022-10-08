console.log('SIPD CRAWLER OK')
console.log(document.body.outerHTML)

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  chrome.tabs.sendMessage(tabs[0].id, {
    action: "sendBody",
    data: document.body.outerHTML
  })
})


// get response from extension
chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
    // console.log(request)

    // get body data action
    if (request.action === 'getBody') {
      console.log(document.body.outerHTML)
      sendResponse({ data: document.body.outerHTML })
    }
  }
);

// send message to extension