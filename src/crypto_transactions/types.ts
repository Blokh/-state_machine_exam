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
    fromWallet: IWallet;
    toWallet: IWallet;
    amount: number;
    score: number;
}

export interface ITransaction extends ITransactionRequest {
    id: string;
}

export interface IBlockedTransaction {
    walletId: IWallet;
    score: TWalletScore;
    blockReason: TBlockageReasons;
}

export interface ISeller {
    id: TSellerId;
    sellerName: string;
}

export interface IWallet {
    seller: ISeller,
    status: TWalletState,
    Score: TWalletScore,
    transactions: ITransaction[] | undefined;
    blockageReason?: TBlockageReasons,
}



