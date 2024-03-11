import express, { Request, Response } from 'express';
import axios from 'axios';

const router = express.Router();

interface PincodeDetails {
  Name: string;
}

interface PincodeResponse {
  Message: string;
  Status: string;
  PostOffice: PincodeDetails[];
}

interface AddressBody {
  pincode: string;
  city: string;
  addressLineOne: string;
  addressLineTwo: string;
}

interface AccuracyResponse {
  accuracy: string;
  address: PincodeDetails | null;
  names: string[];
}

const levenshteinDistance = (s: string, t: string): number => {
  // console.log({ s, t });
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const arr: number[][] = [];
  for (let i = 0; i <= t.length; i++) {
    arr[i] = [i];
    for (let j = 1; j <= s.length; j++) {
      arr[i][j] =
        i === 0
          ? j
          : Math.min(
            arr[i - 1][j] + 1,
            arr[i][j - 1] + 1,
            arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1),
          );
    }
  }
  return arr[t.length][s.length];
};

// Function to calculate accuracy including exact word matches
const calculateAccuracy = (s1: string, s2: string): number => {
  // Convert both strings to lowercase for case-insensitive comparison
  const s1Lower = s1.trim().toLocaleLowerCase();
  const s2Lower = s2.trim().toLocaleLowerCase();

  // Check for exact word matches
  const s1Words = s1Lower.split(/\s+|,/); // Split by whitespace
  const exactMatch = s1Words.every(word => s2Lower.includes(word));
  console.log({ s1Lower, s2Lower, exactMatch });
  // If an exact word match is found, return 100% accuracy
  if (exactMatch) return 1;
  
  // Calculate Levenshtein distance
  const distance = levenshteinDistance(s1Lower, s2Lower);

  // Calculate accuracy based on Levenshtein distance
  const maxLength = Math.max(s1Lower.length, s2Lower.length);
  const levenshteinAccuracy = 1 - distance / maxLength;


  // Otherwise, return Levenshtein accuracy
  return levenshteinAccuracy;
};


// Function to fetch pincode details from the API
const fetchPincodeDetails = async (pincode: string): Promise<PincodeResponse> => {
  try {
    const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`);
    return response.data[0] as PincodeResponse;
  } catch (error) {
    throw new Error('Error fetching pincode details');
  }
};

// POST endpoint to calculate accuracy
router.post('/calculate_accuracy', async (req: Request<{}, {}, AddressBody>, res: Response<AccuracyResponse | { error: string }>) => {
  const { pincode, city, addressLineOne, addressLineTwo } = req.body;

  // console.log({ pincode, city, addressLineOne, addressLineTwo });
  
  try {
    const pincodeDetails = await fetchPincodeDetails(pincode);

    if (pincodeDetails.Status === 'Error' || !pincodeDetails.PostOffice) {
      return res.status(400).json({ error: 'Invalid PIN code or no records found.' });
    }

    let maxAccuracy = 0;
    let maxAccuracyAddress: PincodeDetails | null = null;
    let names = new Set<string>();

    pincodeDetails.PostOffice.forEach(element => {
      names.add(element.Name);
    });

    for (const postOffice of pincodeDetails.PostOffice) {
      const { Name } = postOffice;
      let accuracy = 0;

      // Check accuracy with city
      accuracy = calculateAccuracy(Name, city);

      // console.log({ city, accuracy });

      if (accuracy === 1) {
        return res.json({ accuracy: '100', address: postOffice, names: Array.from(names) });
      }

      maxAccuracy = accuracy;
      maxAccuracyAddress = postOffice;

      // Check accuracy with address line one
      accuracy = calculateAccuracy(Name, addressLineOne);

      if (accuracy === 1) {
        return res.json({ accuracy: (accuracy * 100).toFixed(2), address: postOffice, names: Array.from(names) });
      }

      if (accuracy > maxAccuracy) {
        maxAccuracy = accuracy;
        maxAccuracyAddress = postOffice;
      }

      // Check accuracy with address line two
      accuracy = calculateAccuracy(Name, addressLineTwo);
      // console.log({ addressLineTwo, Name, accuracy });
      if (accuracy > maxAccuracy) {
        maxAccuracy = accuracy;
        maxAccuracyAddress = postOffice;
      }
    }

    return res.json({ accuracy: (maxAccuracy * 100).toFixed(2), address: maxAccuracyAddress, names: Array.from(names) });
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
