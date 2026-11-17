# Template: New Kora Example

```kora
// examples/XX_feature/main.kora
import { FeatureRouter } from "./routes/feature.routes"

class Application {
    init() {}

    fn bootstrap() -> Unit {
        let app = run()
        app.use(FeatureRouter)
        app.listen(8080)
    }
}

let app = Application()
app.bootstrap()
```
