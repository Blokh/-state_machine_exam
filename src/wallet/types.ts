export const WALLET_STATE = {
    ACTIVE: 'active',
    BLOCKED: 'blocked'
} as const;

export type ObjectValues<TObject> = TObject[keyof TObject];
export type TWalletState = ObjectValues<typeof WALLET_STATE>
export type TSellerId = number;
export type TWalletScore = number;
// export type negativeScoreValues  =  -10 | -1 | -2 | -3 | -4 | -5 | -6 | -7 | -8 | -9
// export type positiveScoreValues  =  0 | 1 | 2| 3 | 4| 5



export interface TTransactionRequest {
    amount: number;
    score: number;
}

export interface TTransaction extends TTransactionRequest {
    id: string;
    fromWallet: IWallet;
    toWaller: IWallet;
}

export interface IWallet {
    sellerId: TSellerId,
    walletState: TWalletState,
    walletScore: TWalletScore,
    tractions: TTransaction[] | undefined;
}