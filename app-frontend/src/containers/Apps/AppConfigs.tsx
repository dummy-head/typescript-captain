import React, { Component } from "react";
import {
  message,
  Row,
  Button,
  Input,
  Col,
  Icon,
  Tooltip,
  Checkbox
} from "antd";
import Toaster from "../../utils/Toaster";
import Utils from "../../utils/Utils";
import { AppDetailsTabProps } from "./AppDetails";

const Search = Input.Search;

export default class AppConfigs extends Component<
  AppDetailsTabProps,
  { dummyVar: undefined; forceEditableInstanceCount: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      dummyVar: undefined,
      forceEditableInstanceCount: false
    };
  }

  createEnvVarRows() {
    const self = this;
    const envVars = this.props.apiData.appDefinition.envVars;
    return Utils.map(envVars, function(value, index) {
      return (
        <Row style={{ paddingBottom: 12 }} key={"" + index}>
          <Col span={8}>
            <Input
              className="code-input"
              placeholder="key"
              value={value.key}
              type="text"
              onChange={e => {
                const newApiData = Utils.copyObject(self.props.apiData);
                newApiData.appDefinition.envVars[index].key = e.target.value;
                self.props.updateApiData(newApiData);
              }}
            />
          </Col>
          <Col style={{ paddingLeft: 12 }} span={16}>
            <Input.TextArea
              className="code-input"
              placeholder="value"
              rows={1}
              value={value.value}
              onChange={e => {
                const newApiData = Utils.copyObject(self.props.apiData);
                newApiData.appDefinition.envVars[index].value = e.target.value;
                self.props.updateApiData(newApiData);
              }}
            />
          </Col>
        </Row>
      );
    });
  }

  createPortRows() {
    const self = this;
    const ports = this.props.apiData.appDefinition.ports;
    return Utils.map(ports, function(value, index) {
      return (
        <Row style={{ paddingBottom: 12 }} key={"" + index}>
          <Col span={12}>
            <Tooltip title="Make sure the port is not already used!">
              <Input
                addonBefore="Server Port"
                placeholder="5050"
                value={value.hostPort ? value.hostPort + "" : ""}
                type="number"
                onChange={e => {
                  const newApiData = Utils.copyObject(self.props.apiData);
                  const p = Number(e.target.value.trim());
                  newApiData.appDefinition.ports[index].hostPort =
                    p > 0 ? p : 0; // to avoid NaN
                  self.props.updateApiData(newApiData);
                }}
              />
            </Tooltip>
          </Col>
          <Col style={{ paddingLeft: 12 }} span={12}>
            <Input
              addonBefore="Container Port"
              placeholder="6060"
              value={value.containerPort ? value.containerPort + "" : ""}
              onChange={e => {
                const newApiData = Utils.copyObject(self.props.apiData);
                const p = Number(e.target.value.trim());
                newApiData.appDefinition.ports[index].containerPort =
                  p > 0 ? p : 0; // to avoid NaN
                self.props.updateApiData(newApiData);
              }}
            />
          </Col>
        </Row>
      );
    });
  }

  createVolRows() {
    const self = this;
    const volumes = this.props.apiData.appDefinition.volumes;
    return Utils.map(volumes, function(value, index) {
      return (
        <Row style={{ paddingBottom: 12 }} key={"" + index}>
          <Col span={8}>
            <Input
              addonBefore="Path in App"
              className="code-input"
              placeholder="/var/www/html"
              value={value.containerPath}
              type="text"
              onChange={e => {
                const newApiData = Utils.copyObject(self.props.apiData);
                newApiData.appDefinition.volumes[index].containerPath =
                  e.target.value;
                self.props.updateApiData(newApiData);
              }}
            />
          </Col>
          <Col
            style={{ paddingLeft: 12 }}
            span={8}
            className={value.hostPath ? "hide-on-demand" : ""}
          >
            <Input
              addonBefore="Label"
              className="code-input"
              placeholder="some-name"
              value={value.volumeName}
              onChange={e => {
                const newApiData = Utils.copyObject(self.props.apiData);
                newApiData.appDefinition.volumes[index].volumeName =
                  e.target.value;
                self.props.updateApiData(newApiData);
              }}
            />
          </Col>

          <Col
            style={{ paddingLeft: 12 }}
            span={8}
            className={!value.hostPath ? "hide-on-demand" : ""}
          >
            <Tooltip title="IMPORTANT: Ensure Host Path exists before assigning it here">
              <Input
                addonBefore="Path on Host"
                className="code-input"
                placeholder="/host/path/exists"
                value={value.hostPath}
                onChange={e => {
                  const newApiData = Utils.copyObject(self.props.apiData);
                  newApiData.appDefinition.volumes[index].hostPath =
                    e.target.value;
                  self.props.updateApiData(newApiData);
                }}
              />
            </Tooltip>
          </Col>
          <Col style={{ paddingLeft: 12 }} span={8}>
            <Button
              type="dashed"
              onClick={() => {
                const newApiData = Utils.copyObject(self.props.apiData);
                newApiData.appDefinition.volumes[index].hostPath = newApiData
                  .appDefinition.volumes[index].hostPath
                  ? ""
                  : "/";
                self.props.updateApiData(newApiData);
              }}
            >
              {value.hostPath
                ? "Let Captain manage path"
                : "Set specific host path"}
            </Button>
          </Col>
        </Row>
      );
    });
  }

  createVolSection() {
    const app = this.props.apiData!.appDefinition;

    if (!app.hasPersistentData) return <div />;

    return (
      <div>
        <h4>
          Persistent Directories &nbsp;
          <a
            href="https://captainduckduck.com/docs/app-configuration.html#persistent-or-not"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon type="info-circle" />
          </a>
        </h4>
        <div
          className={
            app.volumes && !!app.volumes.length ? "hide-on-demand" : ""
          }
        >
          <i>Currently, this app does not have any persistent directories.</i>
        </div>

        {this.createVolRows()}
        <br />
        <Button type="default" onClick={() => this.addVolumeClicked()}>
          Add Persistent Directory
        </Button>
        <br />
        <br />
        <br />
        <br />
      </div>
    );

    /*
                      <div class="row">
                        <div class="col-md-12">
                          <button type="button" ng-click="addVolumeClicked()" class="btn btn-default">Add Directory</button>
                        </div>
                      </div>

                      <hr/>

                      <div class="row">
                        <div class="form-group col-md-6">
                          <div class="input-group">
                            <span class="input-group-addon">

                              <a href="" uib-tooltip="Click to edit" ng-click="unlockNodeId()">
                                Node ID &nbsp;
                                <i class="fa fa-pencil" aria-hidden="true"></i>
                              </a>

                            </span>
                            <input uib-tooltip="Leave empty for automatic placement" type="text" class="form-control" ng-disabled="!app.unlockNodeIdForEdit"
                              ng-model="app.nodeId">
                          </div>
                          <div class="input-group">
                          </div>
                        </div>
                        <div class="col-md-6">
                          <p>
                            <b>WARNING: </b>Changing Node ID causes the content of your persistent directories to be deleted!
                          </p>
                        </div>
                      </div>
    */
  }

  render() {
    const app = this.props.apiData!.appDefinition;
    return (
      <div>
        <h4>Environmental Variables:</h4>
        <div
          className={
            app.envVars && !!app.envVars.length ? "hide-on-demand" : ""
          }
        >
          <i>
            Currently, this app does not have any custom environmental variables
            yet.
          </i>
        </div>

        {this.createEnvVarRows()}

        <br />

        <Button type="default" onClick={() => this.addEnvVarClicked()}>
          Add Key/Value Pair
        </Button>

        <br />
        <br />
        <br />

        <h4>
          Port Mapping &nbsp;
          <a
            href="https://captainduckduck.com/docs/app-configuration.html#port-mapping"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon type="info-circle" />
          </a>
        </h4>
        <div
          className={app.ports && !!app.ports.length ? "hide-on-demand" : ""}
        >
          <i>Currently, this app does not have any custom port mapping.</i>
        </div>

        {this.createPortRows()}

        <br />

        <Button type="default" onClick={() => this.addPortMappingClicked()}>
          Add Port Mapping
        </Button>
        <br />
        <br />
        <br />
        {this.createVolSection()}
        <Row>
          <Col span={6} style={{ width: 200 }}>
            <Tooltip title="Number of running instances of this app">
              <Input
                addonBefore="Instance Count"
                type="number"
                defaultValue={app.instanceCount + ""}
                disabled={
                  app.hasPersistentData &&
                  !this.state.forceEditableInstanceCount
                }
              />
            </Tooltip>
          </Col>
          <Col span={6}>
            <div className={!app.hasPersistentData ? "hide-on-demand" : ""}>
              <Tooltip title="Multiple instances of apps with persistent data can be very dangerous and bug prone as they can be accessing the same file on the disk resulting in data corruption. Edit the instance count only if you understand the risk.">
                <Button
                  type="default"
                  disabled={this.state.forceEditableInstanceCount}
                  onClick={() =>
                    this.setState({ forceEditableInstanceCount: true })
                  }
                >
                  Edit
                </Button>
              </Tooltip>
            </div>
          </Col>
        </Row>

        {/* <div class="row">
        <div class="col-lg-12">
          <div class="row">
            <a href="" ng-click="onPreDeployFunctionToggled()">
              <h5>{{!!app.hasPreDeployFunction? 'Remove':'Add'}} Pre-Deploy Script
                &nbsp;
                <a href="https://captainduckduck.com/docs/pre-deploy-script.html" target="_blank" rel="noopener noreferrer">
                  &nbsp; <i class="fa fa-info-circle" aria-hidden="true"></i>
                </a>

              </h5>
            </a>
          </div>

          <div class="row" ng-show="!!app.hasPreDeployFunction">
                <textarea id="post-deploy-text-id" style="padding:10px; background: #f9f9f9" rows="10"
                          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                          ng-model = "app.preDeployFunction"
                          class="col-sm-12"></textarea>
          </div>

        </div>
      </div>

      </div> */}
      </div>
    );
  }

  addPortMappingClicked() {
    const newApiData = Utils.copyObject(this.props.apiData);
    newApiData.appDefinition.ports = newApiData.appDefinition.ports || {};
    newApiData.appDefinition.ports.push({
      containerPort: 0,
      hostPort: 0
    });
    this.props.updateApiData(newApiData);
  }

  addEnvVarClicked() {
    const newApiData = Utils.copyObject(this.props.apiData);
    newApiData.appDefinition.envVars = newApiData.appDefinition.envVars || {};
    newApiData.appDefinition.envVars.push({
      key: "",
      value: ""
    });
    this.props.updateApiData(newApiData);
  }

  addVolumeClicked() {
    const newApiData = Utils.copyObject(this.props.apiData);
    newApiData.appDefinition.volumes = newApiData.appDefinition.volumes || {};
    newApiData.appDefinition.volumes.push({
      containerPath: "",
      volumeName: ""
    });
    this.props.updateApiData(newApiData);
  }

  reFetchData() {
    this.props.reFetchData();
  }
}
