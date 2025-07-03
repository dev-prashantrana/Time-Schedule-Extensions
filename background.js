// background.js

chrome.runtime.onInstalled.addListener(() => {
  console.log("Time Schedule extension installed.");
  chrome.alarms.clearAll(); // Clean slate on install
});

// Listen for alarms and show notifications
chrome.alarms.onAlarm.addListener((alarm) => {
  const { taskText, taskTime } = alarm;
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'image.png',
    title: '⏰ Task Reminder',
    message: `${taskText} (${taskTime})`,
    priority: 2
  });
});

// Utility to schedule a reminder alarm
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'scheduleReminder') {
    const { taskText, taskTime, alarmName, when } = msg;
    chrome.alarms.create(alarmName, { when });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === alarmName) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'image.png',
          title: '⏰ Task Reminder',
          message: `${taskText} (${taskTime})`,
          priority: 2
        });
      }
    });
    sendResponse({ status: 'scheduled' });
  }
});