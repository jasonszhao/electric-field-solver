/*******************
 * Helper Functions
 *******************/

function getCoreCount() {
  let cores = window.navigator.hardwareConcurrency
  if(!cores) {
      // this makes me angry (looking at you, Safari). it's not worth the effort
      
      const w = window.screen.width * window.devicePixelRatio
      const h = window.screen.height * window.devicePixelRatio
      
      if (w === 2880 && h === 1800) { cores = 8 } // MacBook Pro 15" retina
      else { cores = 4 }
  }

  return cores
}

const run_f = args => worker => {
    return worker.run(args)
    
        //the show must go on no matter what.
        .catch(e => console.error(e))
        
        .then(result => {
            worker.is_busy(false)

            return {
                args,
                worker,
                result
            }
        })
}

/***********************
 * End Helper Functions
 ***********************/


function WorkerManager() {
    // TODO: support fallbacks when worker errors out

    /*
    interface AbstractWorker<T>() {
      is_busy: flyd.Stream(Boolean),
      destroy: () => {},
      run: args => Promise(T)
    }
    */
    this.worker_pool = []

    // this.queue :: [queue_item]
    /*
    queue_item :: worker => ({
        wrapped_f,
        args,
        worker
    })
    */
    this.queue = []
    this.processed = []
}

WorkerManager.prototype.queue_pluck_one = function () {
    const available_worker = this.worker_pool.find(w => !w.is_busy())

    if(available_worker === undefined)
        return

    const job = this.queue.shift()
    if(job !== undefined) {
        available_worker.is_busy(true)
        job(available_worker)
    }
}
WorkerManager.prototype.queue_push = function (args) {
    // Promises automatically unnest themselves
    return new Promise((resolve, reject) => {
        const linked_job = worker => 
            run_f(args)(worker)
                .then(x => {
                    this.processed.push(x)
                    return x
                })
                .then(x => {
                    this.queue_pluck_one()
                    return x
                })
                .then(resolve)

        this.queue.push(linked_job)

        this.queue_pluck_one()
    })
}

WorkerManager.prototype.worker_add = function(worker) {
    flyd.on(is_busy => {
        
        const job = this.queue.shift()
        if(job !== undefined) {
            worker.is_busy(true)
            job(worker)
        }

    }, flyd.filter(x => !x, worker.is_busy))

    this.worker_pool.push(worker)
}


