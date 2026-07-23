export const socialTrustProfilesAbi = [
  {
    type: 'function',
    name: 'setProfile',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'displayName', type: 'string' },
      { name: 'xUsername', type: 'string' },
      { name: 'telegramUsername', type: 'string' },
      { name: 'discordUsername', type: 'string' },
      { name: 'imgUrl', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getProfile',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'displayName', type: 'string' },
          { name: 'xUsername', type: 'string' },
          { name: 'telegramUsername', type: 'string' },
          { name: 'discordUsername', type: 'string' },
          { name: 'imgUrl', type: 'string' },
          { name: 'exists', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getProfiles',
    stateMutability: 'view',
    inputs: [{ name: 'users', type: 'address[]' }],
    outputs: [
      {
        name: 'result',
        type: 'tuple[]',
        components: [
          { name: 'displayName', type: 'string' },
          { name: 'xUsername', type: 'string' },
          { name: 'telegramUsername', type: 'string' },
          { name: 'discordUsername', type: 'string' },
          { name: 'imgUrl', type: 'string' },
          { name: 'exists', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'hasProfile',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'event',
    name: 'ProfileUpdated',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'displayName', type: 'string', indexed: false },
      { name: 'xUsername', type: 'string', indexed: false },
      { name: 'telegramUsername', type: 'string', indexed: false },
      { name: 'discordUsername', type: 'string', indexed: false },
      { name: 'imgUrl', type: 'string', indexed: false },
    ],
    anonymous: false,
  },
] as const
