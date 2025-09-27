import { customAlphabet, urlAlphabet } from 'nanoid';

// filter urlAlphabet to remove uppercase letters
const filteredUrlAlphabet = urlAlphabet.replace(/[A-Z]/g, '');
const nanoid = customAlphabet(filteredUrlAlphabet, 7);

export default nanoid;
