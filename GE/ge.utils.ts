const Entities = require('html-entities').AllHtmlEntities;
export const entities = new Entities();

export const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toISOString();
};