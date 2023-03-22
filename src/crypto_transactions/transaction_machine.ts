import {ITransaction, ITransactionRequest} from './types'
import {createMachine} from "xstate";
import {v4 as uuidv4} from 'uuid';

let runningTransaction = []


const isReceivingSellerBlocked = (request: ITransactionRequest | ITransaction) => {
    return request.toWallet.State == 'blocked'
}

const isTransactionFromWalletAlreadyEnqueued = (transactionRequest: ITransactionRequest) : boolean => {
    let isSellerAlreadySending = runningTransaction.includes(transactionRequest.fromWallet.seller.id);

    return isSellerAlreadySending
}

const assignSendingInTransaction = (transactionRequest: ITransactionRequest) : ITransaction => {
    const transactionId = uuidv4();
    const transaction = transactionRequest as ITransaction
    transaction.id = transactionId

    return transaction
}

const lightMachine = createMachine({
    id: 'TRANSACTION_MACHINE',
    initial: 'PENDING_TRANSACTION',
    states: {
        PENDING_TRANSACTION: {
            on: {
                'TRANSACTION_REQUESTED': [
                    {
                        target: 'BLOCK_SENDER_WALLET',
                        cond: isReceivingSellerBlocked
                    },
                    {
                        cond: (transactionRequest: ITransactionRequest) => isTransactionFromWalletAlreadyEnqueued(transactionRequest),
                        target: 'RE_ENQUEUE_TRANSACTION'
                    }
                ]
            }
        },
    }
});
