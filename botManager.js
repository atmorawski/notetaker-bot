export let meetings = [];

export async function createMeeting(payload) {
  return {
    id: payload.id,
    meetingUrl: payload.meetingUrl ?? null,
    displayName: payload.displayName ?? null,
    isRecording: {
      audio: payload.isRecording?.audio ?? false,
      video: payload.isRecording?.video ?? false,
    },
    isStopped: payload.isStopped ?? false,
    isStopping: false,
    stopReason: null,
    page: null,
    stream: null,
    file: null,
    filePath: null,
    processedFilePath: null,
    compressedFilePath: null,
    transcript: null,
    joinedAt: null,
    startedRecordingAt: null,
    autoStopInterval: null,
    silentWindows: 0,
  };
}

export async function BotManager(obj, stop = false) {
  const { id } = obj;
  let meeting = meetings.find((item) => item.id === id);

  if (stop && meeting) {
    meeting.isStopped = true;
    return meetings;
  }

  if (!meeting) {
    meetings.push(await createMeeting(obj));
  } else {
    meeting.isStopped = false;
    meeting.meetingUrl = obj.meetingUrl ?? meeting.meetingUrl;
    meeting.displayName = obj.displayName ?? meeting.displayName;
    meeting.isRecording = obj.isRecording ?? meeting.isRecording;
  }

  return meetings;
}
