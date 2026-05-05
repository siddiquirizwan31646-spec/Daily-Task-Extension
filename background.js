// background.js — resets tasks daily at midnight

chrome.alarms.create("midnight-reset", {
  when: getNextMidnight(),
  periodInMinutes: 1440
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "midnight-reset") return;

  const data = await chrome.storage.local.get(["tasks", "history"]);
  const tasks = data.tasks || [];
  const history = data.history || [];

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateKey = yesterday.toISOString().split("T")[0];

  // Save yesterday's completion to history
  const record = {
    date: dateKey,
    tasks: tasks.map(t => ({
      name: t.name,
      done: t.done
    }))
  };

  history.push(record);

  // Reset all tasks for today
  const resetTasks = tasks.map(t => ({ ...t, done: false }));

  await chrome.storage.local.set({
    tasks: resetTasks,
    history,
    lastReset: dateKey
  });
});

function getNextMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime();
}
