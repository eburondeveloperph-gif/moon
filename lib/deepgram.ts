import { createClient } from '@deepgram/sdk';

export const getDeepgramClient = () => {
  const apiKey = import.meta.env.DEEPGRAM_API_KEY || '6330d8d2cf4c9f1343f306f1ebc00cb36780089c';
  return createClient(apiKey);
};

export const createDeepgramLive = async (client: any) => {
  const connection = client.listen.live({
    model: 'nova-3',
    language: 'nl-BE', // Flemish/Dutch
    smart_format: true,
    interim_results: true,
    endpointing: 300,
  });

  return connection;
};
