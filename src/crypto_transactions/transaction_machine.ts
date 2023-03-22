import {BLOCKAGE_REASONS, ITransaction, ITransactionRequest, IWallet, TBlockageReasons, WALLET_STATE} from './types'
import {assign, createMachine} from "xstate";
import {v4 as uuidv4} from 'uuid';
import {after} from "xstate/es/actions";

let runningSellerTransaction = []

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
        walletBlockReason: undefined,
    },
    states: {
        PENDING_TRANSACTION: {
            on: {
                'TRANSACTION_REQUESTED': [
                    { target: 'BLOCK_SENDER_WALLET', cond: 'unauthorizedReceiverWallet' },
                    { target: 'TRANSACTION_RETRY_IN_60', cond: 'isTransactionFromWalletAlreadyEnqueued' },
                    { actions: 'assignSendingInTransaction', target: 'FETCH_TRANSACTION_CONFIGURATION' },
                ]
            },
        },
        BLOCK_SENDER_WALLET: {
            on: {
                action: 'blockSenderWallet',
                target: 'UNLOCK_SENDER_WALLET'
            }
        },
        TRANSACTION_RETRY_IN_60: {
            on: { target: 'PENDING_TRANSACTION'},
            after: { 60000: [ {target: 'TRANSACTION_REQUESTED'}]},
        },
        RE_ENQUEUE_TRANSACTION: {},
        FETCH_TRANSACTION_CONFIGURATION: {},
        ENQUEUE_TRANSACTION: {},
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
        blockSenderWallet: (context, event) => blockSenderWallet(context.transactionRequest, context.walletBlockReason)
    },
    guards: {
        unauthorizedReceiverWallet: (context, event) => {
            if (isReceivingSellerBlocked(context.transactionRequest as ITransaction)) {
                assign({walletBlockReason: BLOCKAGE_REASONS.SENT_TO_BLOCKED_WALLET})

                return true
            }
            return false
        },
        isTransactionFromWalletAlreadyEnqueued: (context, event) => {
            return true;
        }
    }
});