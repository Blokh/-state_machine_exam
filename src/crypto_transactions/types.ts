export const WALLET_STATE = {
    ACTIVE: 'active',
    BLOCKED: 'blocked'
} as const;

export const BLOCKAGE_REASONS = {
    SENT_TO_BLOCKED_WALLET: 'SENT_TO_BLOCKED_WALLET',
    EXCEEDED_RISK_RANK_LIMIT: 'EXCEEDED_RISK_RANK_LIMIT',
} as const;


export type ObjectValues<TObject> = TObject[keyof TObject];
export type TWalletState = ObjectValues<typeof WALLET_STATE>
export type TBlockageReasons = ObjectValues<typeof BLOCKAGE_REASONS>
export type TSellerId = number;
export type TWalletRank = number;

export interface ITransactionRequest {
    fromWallet: IWallet;
    toWallet: IWallet;
    amount: number;
    rank: number;
}

export interface ITransaction extends ITransactionRequest {
    id: string;
}

export interface IBlockedTransaction {
    walletId: IWallet;
    score: TWalletRank;
    blockReason: TBlockageReasons;
}

export interface ISeller {
    id: TSellerId;
    sellerName: string;
}

export interface IWallet {
    seller: ISeller,
    status: TWalletState,
    riskRank: TWalletRank,
    isInternal: boolean,
    transactions: ITransaction[] | undefined;
    blockageReason?: TBlockageReasons,
}



