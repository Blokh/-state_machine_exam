import {ITransaction, ITransactionRequest, IWallet, TBlockageReasons, WALLET_STATE} from './types'
import {assign, createMachine} from "xstate";
import {v4 as uuidv4} from 'uuid';

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

const blockSellerWallet = (transactionRequest: ITransactionRequest, walletBlockageReason: TBlockageReasons): void => {
    let sendingWallet = transactionRequest.fromWallet
    sendingWallet.status = WALLET_STATE.BLOCKED;
    sendingWallet.blockageReason = walletBlockageReason;
}

const transactionMachine = createMachine({
    id: 'TRANSACTION_MACHINE',
    initial: 'PENDING_TRANSACTION',
    states: {
        PENDING_TRANSACTION: {
            on: {
                'TRANSACTION_REQUESTED': [
                    {
                        target: 'BLOCK_SENDER_WALLET',
                        cond: 'unauthorizedReceiverWallet'
                        // action: 'calculateBlockageReason'
                    },
                    {
                        target: 'RE_ENQUEUE_TRANSACTION',
                        cond: (transactionRequest: ITransactionRequest) => isTransactionFromWalletAlreadyEnqueued(transactionRequest)
                    },
                    {
                        target: 'FETCH_TRANSACTION_CONFIGURATION',
                        action: 'assignSendingInTransaction'
                    }
                ]
            },
        },

        BLOCK_SENDER_WALLET: {},
        RE_ENQUEUE_TRANSACTION: {},
        FETCH_TRANSACTION_CONFIGURATION: {},
        ENQUEUE_TRANSACTION: {},
        PERSIST_TRANSACTION_TO_WALLETS: {},
        PERSIST_NEW_SENDER_WALLET_RANK: {},
        UNBLOCK_SENDER_WALLET: {},
    }
}, {
    actions: {
        assignSendingInTransaction: (context, event) => {
            assignSendingInTransaction(context as ITransactionRequest)
        }
    },
    guards: {
        unauthorizedReceiverWallet: (context, event) => {
            return isReceivingSellerBlocked(context as ITransaction)
        },
    }
});


// const remittanceMachine = createMachine({
//     on: {
//         'NEW_TRNASACTION_REQUEST': {
//             // actions: assign({transactionRequest: (context, event) => {
//             //     ...context.requests
//             //     }})
//         },
//
//     }
// })