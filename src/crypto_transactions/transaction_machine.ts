import {
    BLOCKAGE_REASONS,
    ITransaction,
    ITransactionRequest,
    IWallet,
    TBlockageReasons,
    TWalletRank,
    WALLET_STATE
} from './types'
import {assign, createMachine} from "xstate";
import {v4 as uuidv4} from 'uuid';

const INTERNAL_LIMIT_THRESHOLD = 300;
const EXTERNAL_LIMIT_THRESHOLD = 100;
const INTERNAL_PERCENTAGE_ADDITIONAL_RISK_ON_BLOCK = 15;
const EXTERNAL_PERCENTAGE_ADDITIONAL_RISK_ON_BLOCK = 10;

let runningSellerTransaction = []

const persistRankToWaller = (wallet: IWallet, rank: TWalletRank ) => {
    // update wallet rank
}
const isReceivingSellerBlocked = (request: ITransactionRequest | ITransaction) => {
    return request.toWallet.status == WALLET_STATE.BLOCKED
}

const isTransactionFromWalletAlreadyEnqueued = (transactionRequest: ITransactionRequest) : boolean => {
    let isSellerAlreadySending = runningSellerTransaction.includes(transactionRequest.fromWallet.seller.id);

    return isSellerAlreadySending
}

const assignSendingInTransaction = (transactionRequest: ITransactionRequest) : ITransaction => {
    const transactionId = uuidv4();
    const transaction = transactionRequest as ITransaction
    transaction.id = transactionId

    runningSellerTransaction = runningSellerTransaction.concat(transactionRequest.fromWallet.seller.id)
    return transaction
}

const calculateBlockedTransactionNewRiskCount = (transaction: ITransaction) => {
    if (transaction.toWallet.isInternal) {
        persistRankToWaller(transaction.fromWallet, calculateRankPercentageValue(transaction.fromWallet.riskRank, INTERNAL_PERCENTAGE_ADDITIONAL_RISK_ON_BLOCK))
        persistRankToWaller(transaction.toWallet, calculateRankPercentageValue(transaction.toWallet.riskRank, INTERNAL_PERCENTAGE_ADDITIONAL_RISK_ON_BLOCK))
    }else {
        persistRankToWaller(transaction.fromWallet, calculateRankPercentageValue(transaction.fromWallet.riskRank, EXTERNAL_PERCENTAGE_ADDITIONAL_RISK_ON_BLOCK))
    }
}

const calculateRankPercentageValue = (rank: TWalletRank, percentage: number): TWalletRank => {
    return percentage / 100 * rank
}

const blockSenderWallet = (transactionRequest: ITransactionRequest, walletBlockageReason: TBlockageReasons): void => {
    let sendingWallet = transactionRequest.fromWallet
    sendingWallet.status = WALLET_STATE.BLOCKED;
    sendingWallet.blockageReason = walletBlockageReason;
}

const transactionMachine = createMachine({
    id: 'TRANSACTION_MACHINE',
    initial: 'PENDING_TRANSACTION',
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
                    { target: 'blockSenderWallet', cond: 'unauthorizedReceiverWallet' },
                    { target: 'reEnqueueTransaction', cond: 'isTransactionFromWalletAlreadyEnqueued' },
                    { actions: 'assignSendingInTransaction', target: 'validateTransaction' },
                ]
            },
        },
        blockSenderWallet: {
            on: {
                action: 'blockSenderWallet',
                target: 'unlockSenderWallet'
            }
        },
        reEnqueueTransaction: {
            always: { target: 'pendingTransaction'},
            after: { 60000: [ {target: 'TRANSACTION_REQUESTED'}]},
        },
        validateTransaction: {
            always: [
                {target: 'enqueueTransaction', cond: ['isFromInternalToExternal', 'isTransactionFitsExternalConfiguration'], actions: 'persistSumOfRanksToSendingWallet'},
                {target: 'blockTransaction', cond: 'isFromInternalToExternal', actions: 'persistSumOfRanksToSendingWallet'},
                {target: 'enqueueTransaction', cond: 'isTransactionFitsInternalConfiguration'},
                {target: 'blockTransaction'},

            ]
        },
        enqueueTransaction: {},
        blockTransaction: {},
        PERSIST_TRANSACTION_TO_WALLETS: {},
        PERSIST_NEW_SENDER_WALLET_RANK: {},
        UNLOCK_SENDER_WALLET: {
            type: "final"
        },
    }
}, {
    actions: {
        assignSendingInTransaction: (context, event) => {
            assign({transaction: assignSendingInTransaction(context.transactionRequest)})
        },
        blockSenderWallet: (context, event) => blockSenderWallet(context.transactionRequest, context.walletBlockReason),
        persistSumOfRanksToSendingWallet: (context, event) => {
            let summedRank = context.transaction.fromWallet.riskRank + context.transaction.toWallet.riskRank
            persistRankToWaller(context.transaction.fromWallet, summedRank)
            context.transaction.fromWallet.riskRank = summedRank
        }
    },
    guards: {
        unauthorizedReceiverWallet: (context, event) => {
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
            return !context.transaction.toWallet.isInternal
        },
        isTransactionFitsInternalConfiguration: (context, event) => {
            let transactionRiskRank = context.transaction.fromWallet.riskRank + context.transaction.toWallet.riskRank;

            return context.transaction.toWallet.status == WALLET_STATE.ACTIVE && transactionRiskRank < INTERNAL_LIMIT_THRESHOLD
        },
        isTransactionFitsExternalConfiguration: (context, event) => {
            let transactionRiskRank = context.transaction.fromWallet.riskRank + context.transaction.toWallet.riskRank;

            return context.transaction.toWallet.status == WALLET_STATE.ACTIVE && transactionRiskRank < EXTERNAL_LIMIT_THRESHOLD
        }


    }
});