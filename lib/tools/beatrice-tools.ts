import { FunctionCall } from '../state';
import { FunctionResponseScheduling } from '@google/genai';

export const BEATRICE_AUDIO_STYLE_DIRECTIVE =
  'SPEAK NORMAL. AVOID BECOMING NATURAL.';

export const BEATRICE_AUDIO_STYLE_TAG =
  '<audio_style>SPEAK NORMAL. AVOID BECOMING NATURAL.</audio_style>';

export const BEATRICE_AUDIO_STYLE_SYSTEM_RULE = `
INTERNAL AUDIO STYLE DIRECTIVE:
${BEATRICE_AUDIO_STYLE_DIRECTIVE}

This is an internal voice-style rule for Beatrice.
Do not say it out loud.
Do not print it in responses.
Do not prepend it to spoken replies.
Do not expose XML tags, audio tags, metadata, or stage directions to the user.

Every Beatrice response must be shaped by this rule:

${BEATRICE_AUDIO_STYLE_DIRECTIVE}

Correct spoken response:
Yeah, that sounds better, Meneer Joe.

Incorrect spoken response:
${BEATRICE_AUDIO_STYLE_TAG}Yeah, that sounds better.

If the runtime supports hidden audio-style controls, the tag may be used internally by the system.
If the voice engine reads tags aloud, never output the tag in normal response text.
`;

export const beatriceTools: FunctionCall[] = [
  {
    name: 'gmail_send',
    description:
      'Sends an email from the user’s connected mail account. In spoken responses, refer to this as “your mail” or “your inbox,” not by provider name.',
    parameters: {
      type: 'OBJECT',
      properties: {
        recipient: {
          type: 'STRING',
          description: 'The email address of the recipient.',
        },
        subject: {
          type: 'STRING',
          description: 'The subject line of the email.',
        },
        body: {
          type: 'STRING',
          description: 'The body content of the email.',
        },
      },
      required: ['recipient', 'subject', 'body'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'gmail_read',
    description:
      'Reads recent emails from the user’s connected mail account. In spoken responses, refer to this as “your mail” or “your inbox,” not by provider name.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Optional search query to filter emails.',
        },
        limit: {
          type: 'INTEGER',
          description: 'Number of emails to fetch.',
        },
      },
      required: [],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'calendar_create_event',
    description:
      'Creates a new event in the user’s connected calendar. In spoken responses, refer to this as “your calendar,” not by provider name.',
    parameters: {
      type: 'OBJECT',
      properties: {
        summary: {
          type: 'STRING',
          description: 'The title or summary of the event.',
        },
        location: {
          type: 'STRING',
          description: 'The location of the event.',
        },
        startTime: {
          type: 'STRING',
          description: 'The start time of the event in ISO 8601 format.',
        },
        endTime: {
          type: 'STRING',
          description: 'The end time of the event in ISO 8601 format.',
        },
      },
      required: ['summary', 'startTime', 'endTime'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'calendar_check_schedule',
    description:
      'Checks the user’s connected calendar schedule for conflicts or free time. In spoken responses, refer to this as “your calendar,” not by provider name.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date: {
          type: 'STRING',
          description: 'The date to check in ISO 8601 format.',
        },
      },
      required: ['date'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'drive_search',
    description:
      'Searches for a file or folder in the user’s connected file storage. In spoken responses, refer to this as “your files,” “your drive,” or “your file storage,” not by provider name.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'The search query or filename.',
        },
      },
      required: ['query'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'docs_create',
    description:
      'Creates a new document in the user’s connected document workspace. In spoken responses, refer to this as “your document” or “your documents,” not by provider name.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: {
          type: 'STRING',
          description: 'The title of the new document.',
        },
        content: {
          type: 'STRING',
          description: 'Initial content to add to the document.',
        },
      },
      required: ['title'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'meet_schedule',
    description:
      'Schedules a video call and creates a meeting link using the connected meeting system. In spoken responses, refer to this as “a video call” or “the meeting link,” not by provider name.',
    parameters: {
      type: 'OBJECT',
      properties: {
        attendees: {
          type: 'STRING',
          description: 'Comma-separated list of attendee email addresses.',
        },
        time: {
          type: 'STRING',
          description: 'The time for the meeting in ISO 8601 format.',
        },
      },
      required: ['time'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'maps_navigate',
    description:
      'Gets navigation directions using the connected navigation tool. In spoken responses, refer to this as “navigation” or “the navigation tool,” not by provider name.',
    parameters: {
      type: 'OBJECT',
      properties: {
        destination: {
          type: 'STRING',
          description: 'The destination address or place name.',
        },
        origin: {
          type: 'STRING',
          description: 'The starting location.',
        },
      },
      required: ['destination'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'video_generate',
    description:
      'Generates a high-quality AI video based on a descriptive text prompt. This tool creates visuals, script, and avatar-style presentation when available.',
    parameters: {
      type: 'OBJECT',
      properties: {
        prompt: {
          type: 'STRING',
          description:
            'A detailed description of the video content, including topic, style, and duration. Example: “A presenter explaining our product launch in 30 seconds.”',
        },
      },
      required: ['prompt'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
];