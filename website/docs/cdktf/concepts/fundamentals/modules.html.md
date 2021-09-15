---
layout: "docs"
page_title: "Modules"
sidebar_current: "cdktf"
description: "TODO: describe me"
---

# Modules

TODO: Explain what modules archive

## Installing Terraform Modules

For using Terraform modules on the Terraform Registry, see [cdktf.json](./cdktf-json.md).
For using Terraform modules from other sources (local, Github, etc), you have two options:

### Generated Terraform Module Bindings

To get typed module bindings you first need to add the module in your `cdktf.json` file. For a local module it might look like this:

```jsonc
{
  // ...
  "terraformModules": [
    {
      "name": "my-local-module",
      "source": "./path/to/local/terraform/module" // relative to cdktf.json file
    }
  ]
}
```

When you run `cdktf get` the module bindings are generated in the `./.gen` and can be used as `MyLocalModule`.

### `TerraformHclModule`

You can make use of `TerraformHclModule`. This doesn't have type safe inputs/outputs, but allows for creating any terraform module.

TypeScript example:

```typescript
const provider = new TestProvider(stack, "provider", {
  accessKey: "key",
  alias: "provider1",
});

const module = new TerraformHclModule(stack, "test", {
  source: "./foo",
  variables: {
    param1: "value1",
  },
  providers: [provider],
});

new TestResource(stack, "resource", {
  name: module.getString("name"),
});
```

## Working with Module Outputs

A [Terraform module](https://www.terraform.io/docs/modules/index.html) defines multiple resources intended to be used together.
Module [output values](/fundamentals/outputs.html) return results to the calling module, which it can then use to populate arguments elsewhere. The CDK
for Terraform enables the use of interpolated module outputs as inputs to other modules or resources with an output `get` method
for each output.

This TypeScript example uses `vpcIdOutput` to pass the AWS VPC identifier from the `vpc` module to an AWS EKS cluster .

```typescript
const vpc = new Vpc(this, "my-vpc", {
  name: vpcName,
});

new Eks(this, "EksModule", {
  clusterName: "my-kubernetes-cluster",
  vpcId: vpc.vpcIdOutput,
});
```

### Terraform Modules with generated bindings

Outputs can be accessed with an `Output` suffix or in the case of python with an `_output`.
The return type of the outputs is always string, because the output returns an HCL expression representing the underlying Terraform resource.

This means that when the `TerraformOutput` is anything else than a string a typecast is necessary to compile the application (e.g. `mod.numberOutput as number`). This also means if a module returns a list one can not access items or loop over it without using an [escape hatch](./escape-hatch.md).

#### Typescript / Java / C# / Go

```typescript
import { Construct } from "constructs";
import { App, TerraformStack, TerraformOutput } from "cdktf";
// This module can come from a registry or through a local / remote reference
import MyLocalModule from "./.gen/modules/my-local-module";

class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const localModule = new MyLocalModule(this, "local-module", {
      ipAddress: "127.0.0.1",
    });

    new TerraformOutput(this, "dns-server", {
      value: localModule.dnsServerOutput,
    });
  }
}
```

#### Python

```python
#!/usr/bin/env python

from constructs import Construct
from cdktf import App, TerraformStack, TerraformOutput
# This module can come from a registry or through a local / remote reference
from imports.my_local_module import MyLocalModule


class MyStack(TerraformStack):
    def __init__(self, scope: Construct, ns: str):
        super().__init__(scope, ns)

        localModule = MyLocalModule(self, "local-module", ip_address='127.0.0.1')
        TerraformOutput(self, "dns-server", value=localModule.dns_server_output)
```

### `TerraformHclModule`

TODO: Figure out why this doesn't have any content in it :-)