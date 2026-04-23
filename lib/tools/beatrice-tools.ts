import { FunctionCall } from '../state';
import { FunctionResponseScheduling } from '@google/genai';

export const beatriceTools: FunctionCall[] = [
  {
    name: 'gmail_send',
    description: 'Sends an email using Gmail.',
    parameters: {
      type: 'OBJECT',
      properties: {
        recipient: { type: 'STRING', description: 'The email address of the recipient.' },
        subject: { type: 'STRING', description: 'The subject line of the email.' },
        body: { type: 'STRING', description: 'The body content of the email.' },
      },
      required: ['recipient', 'subject', 'body'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'gmail_read',
    description: 'Reads recent emails from Gmail.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Optional search query to filter emails.' },
        limit: { type: 'INTEGER', description: 'Number of emails to fetch.' }
      },
      required: [],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'calendar_create_event',
    description: 'Creates a new event in Google Calendar.',
    parameters: {
      type: 'OBJECT',
      properties: {
        summary: { type: 'STRING', description: 'The title or summary of the event.' },
        location: { type: 'STRING', description: 'The location of the event.' },
        startTime: { type: 'STRING', description: 'The start time of the event in ISO 8601 format.' },
        endTime: { type: 'STRING', description: 'The end time of the event in ISO 8601 format.' },
      },
      required: ['summary', 'startTime', 'endTime'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'calendar_check_schedule',
    description: 'Checks the user\'s Google Calendar schedule for conflicts or free time.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date: { type: 'STRING', description: 'The date to check in ISO 8601 format.' }
      },
      required: ['date'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'drive_search',
    description: 'Searches for a file or folder in Google Drive.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'The search query or filename.' }
      },
      required: ['query'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'docs_create',
    description: 'Creates a new Google Doc.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'The title of the new document.' },
        content: { type: 'STRING', description: 'Initial content to add to the document.' }
      },
      required: ['title'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'meet_schedule',
    description: 'Generates a Google Meet link and schedules a video call.',
    parameters: {
      type: 'OBJECT',
      properties: {
        attendees: { type: 'STRING', description: 'Comma-separated list of attendee email addresses.' },
        time: { type: 'STRING', description: 'The time for the meeting in ISO 8601 format.' }
      },
      required: ['time'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'maps_navigate',
    description: 'Gets navigation directions from Google Maps.',
    parameters: {
      type: 'OBJECT',
      properties: {
        destination: { type: 'STRING', description: 'The destination address or place name.' },
        origin: { type: 'STRING', description: 'The starting location.' }
      },
      required: ['destination'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'video_generate',
    description: 'Generates a high-quality AI video based on a descriptive text prompt. This tool uses an advanced video agent to create visuals, script, and avatar presentation.',
    parameters: {
      type: 'OBJECT',
      properties: {
        prompt: { type: 'STRING', description: 'A detailed description of the video content, including the presenter\'s topic, style, and duration (e.g., "A presenter explaining our product launch in 30 seconds").' }
      },
      required: ['prompt'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  }
];
