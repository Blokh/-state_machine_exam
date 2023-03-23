import {
    BLOCKAGE_REASONS,
    ITransaction,
    ITransactionRequest,
    IWallet,
    TBlockageReasons, TSellerId,
    TWalletRank,
    WALLET_STATE
} from './types'
import {assign, createMachine} from "xstate";
import {v4 as uuidv4} from 'uuid';

const INTERNAL_LIMIT_THRESHOLD = 300;
const EXTERNAL_LIMIT_THRESHOLD = 100;
const INTERNAL_PERCENTAGE_ADDITIONAL_RISK_ON_BLOCK = 15;
const EXTERNAL_PERCENTAGE_ADDITIONAL_RISK_ON_BLOCK = 10;

let runningSellerTransaction = {}

const persistRankToWallet = (wallet: IWallet, rank: TWalletRank ) => {
    wallet.riskRank = rank
    // update wallet rank
}
const isReceivingSellerBlocked = (request: ITransactionRequest | ITransaction) => {
    return request.toWallet.status == WALLET_STATE.BLOCKED
}

const isTransactionFromWalletAlreadyEnqueued = (transactionRequest: ITransactionRequest) : boolean => {
    let isSellerAlreadySending = runningSellerTransaction[fetchSellerIdFromTransaction(transactionRequest)];

    return isSellerAlreadySending
}

const assignSendingInTransaction = (transactionRequest: ITransactionRequest) : ITransaction => {
    const transactionId = uuidv4();
    const transaction = transactionRequest as ITransaction
    transaction.id = transactionId

    return transaction
}

const fetchSellerIdFromTransaction = (transaction: ITransactionRequest | ITransaction): TSellerId => {
    return transaction.fromWallet.seller.id
}
const lockSenderInTransaction = (transactionRequest: ITransactionRequest) : void => {
    let sellerId = fetchSellerIdFromTransaction(transactionRequest);
    runningSellerTransaction[sellerId] = sellerId
}
const unlockSenderInTransaction = (transactionRequest: ITransactionRequest) : void => {
    let sellerId = fetchSellerIdFromTransaction(transactionRequest);
    delete runningSellerTransaction[sellerId]
}

const calculateBlockedTransactionNewRiskCount = (transaction: ITransaction) => {
    if (transaction.toWallet.isInternal) {
        persistRankToWallet(transaction.fromWallet, calculateAddedRankPercentageValue(transaction.fromWallet.riskRank, INTERNAL_PERCENTAGE_ADDITIONAL_RISK_ON_BLOCK))
        persistRankToWallet(transaction.toWallet, calculateAddedRankPercentageValue(transaction.toWallet.riskRank, INTERNAL_PERCENTAGE_ADDITIONAL_RISK_ON_BLOCK))
    }else {
        persistRankToWallet(transaction.fromWallet, calculateAddedRankPercentageValue(transaction.fromWallet.riskRank, EXTERNAL_PERCENTAGE_ADDITIONAL_RISK_ON_BLOCK))
    }
}

const calculateAddedRankPercentageValue = (riskRank: TWalletRank, percentage: number): TWalletRank => {
    let additional_riskRank = percentage / 100 * riskRank;
    return additional_riskRank + riskRank
}

const blockSenderWallet = (transactionRequest: ITransactionRequest, walletBlockageReason: TBlockageReasons): void => {
    let sendingWallet = transactionRequest.fromWallet
    sendingWallet.status = WALLET_STATE.BLOCKED;
    sendingWallet.blockageReason = walletBlockageReason;
}

function isExternalTransaction(transaction) {
    return !transaction.toWallet.isInternal;
}

function isExternalTransactionFitsLimits(transaction) {
    let transactionRiskRank = transaction.fromWallet.riskRank + transaction.toWallet.riskRank;

    return transaction.toWallet.status == WALLET_STATE.ACTIVE && transactionRiskRank < EXTERNAL_LIMIT_THRESHOLD
}

const transactionMachine = createMachine({
    id: 'TRANSACTION_MACHINE',
    initial: 'pendingTransaction',
    predictableActionArguments: true,
    context: {
        transactionRequest: undefined,
        transaction: undefined,
        transactionConfiguration: undefined,
        walletBlockReason: undefined,
    },
    states: {
        pendingTransaction: {
            on: {
                'TRANSACTION_REQUESTED': [
                    { target: 'blockSenderWallet', cond: 'shouldBlockWallet' },
                    { target: 'reEnqueueTransaction', cond: 'isTransactionFromWalletAlreadyEnqueued' },
                    {  target: 'validateTransaction', actions: ['lockSenderInTransaction', 'assignSendingInTransaction'] },
                ]
            },
        },
        reEnqueueTransaction: {
            always: { target: 'pendingTransaction'},
            after: { 5000: [ {target: 'TRANSACTION_REQUESTED'}]}, // here I wanted to send an event once again after a 5 seconds unfortunately could not find how
        },
        validateTransaction: {
            always: [
                {target: 'enqueueTransaction', cond: 'externalTransactionValid', actions: 'persistSumOfRanksToSendingWallet'}, // could not find the reason why it does not allow double condintions to be executed
                {target: 'blockTransaction', cond: 'isFromInternalToExternal', actions: 'persistSumOfRanksToSendingWallet'},
                {target: 'enqueueTransaction', cond: 'isTransactionFitsInternalConfiguration'},
                {target: 'blockTransaction'},

            ]
        },
        blockSenderWallet: {
            on: {
                action: 'blockSenderWallet',
                target: 'unlockSenderTransaction'
            }
        },
        enqueueTransaction: {on: {target: 'unlockSenderTransaction', action: 'persistTransactionsToWallets'}},
        blockTransaction: {on: {target: 'unlockSenderTransaction', action: 'persistNewRankToWallet'}},
        unlockSenderTransaction: {on: {target: 'pendingTransaction', action: 'unlockSenderInTransaction'}},
    }
}, {
    actions: {
        lockSenderInTransaction: (context, event) => {
            assign({transaction: lockSenderInTransaction(context.transactionRequest)})
        },
        assignSendingInTransaction: (context, event) => {
            assign({transaction: assignSendingInTransaction(context.transactionRequest)})
        },
        blockSenderWallet: (context, event) => blockSenderWallet(context.transactionRequest, context.walletBlockReason),
        persistSumOfRanksToSendingWallet: (context, event) => {
            let summedRank = context.transaction.fromWallet.riskRank + context.transaction.toWallet.riskRank
            persistRankToWallet(context.transaction.fromWallet, summedRank)
            context.transaction.fromWallet.riskRank = summedRank
        }, persistNewRankToWallet: (context, event) => {
            calculateBlockedTransactionNewRiskCount(context.transaction)
        }, unlockSenderInTransaction: (context, event) => {
            unlockSenderInTransaction(context.transaction)
        }, persistTransactionsToWallets: (context, event) => {
            // persistTransactionToWallet
        }
    },
    guards: {
        shouldBlockWallet: (context, event) => {
            if (isReceivingSellerBlocked(context.transactionRequest)) {
                assign({walletBlockReason: BLOCKAGE_REASONS.SENT_TO_BLOCKED_WALLET})

                return true
            } else if (context.transactionRequest.fromWallet.score > 600) {
                assign({walletBlockReason: BLOCKAGE_REASONS.EXCEEDED_RISK_RANK_LIMIT})

                return true
            }
            return false
        },

        isTransactionFromWalletAlreadyEnqueued: (context, event) => {
            return isTransactionFromWalletAlreadyEnqueued(context.transactionRequest)
        },
        isFromInternalToExternal: (context, event) => {
            return isExternalTransaction(context)
        },externalTransactionValid: (context, event) => {
            return isExternalTransaction(context.transaction) && isExternalTransactionFitsLimits(context.transaction)
        },
        isTransactionFitsInternalConfiguration: (context, event) => {
            let transaction = context.transaction;
            let transactionRiskRank = transaction.fromWallet.riskRank + transaction.toWallet.riskRank;

            return transaction.toWallet.status == WALLET_STATE.ACTIVE && transactionRiskRank < INTERNAL_LIMIT_THRESHOLD
        },
    }
});