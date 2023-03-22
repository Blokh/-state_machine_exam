export const WALLET_STATE = {
    ACTIVE: 'active',
    BLOCKED: 'blocked'
} as const;

export const BLOCKAGE_REASONS = {
    SENT_TO_BLOCKED_WALLET: 'SENT_TO_BLOCKED_WALLET',
    INTERNAL_RANK_EXCEEDED_THRESHOLD: 'INTERNAL_RANK_EXCEEDED_THRESHOLD',
    EXTERNAL_RANK_EXCEEDED_THRESHOLD: 'EXTERNAL_RANK_EXCEEDED_THRESHOLD'
} as const;

export type ObjectValues<TObject> = TObject[keyof TObject];
export type TWalletState = ObjectValues<typeof WALLET_STATE>
export type TBlockageReasons = ObjectValues<typeof BLOCKAGE_REASONS>
export type TSellerId = number;
export type TWalletScore = number;

export interface ITransactionRequest {
    amount: number;
    score: number;
}

export interface ITransaction extends ITransactionRequest {
    id: string;
    fromWallet: IWallet;
    toWaller: IWallet;
}

export interface IBlockedTransaction {
    walletId: IWallet;
    score: TWalletScore;
    blockReason: TBlockageReasons;
}

export interface ISeller {
    sellerId: TSellerId;
    sellerName: string;
}

export interface IWallet {
    seller: ISeller,
    State: TWalletState,
    Score: TWalletScore,
    transactions: ITransaction[] | undefined;
}



