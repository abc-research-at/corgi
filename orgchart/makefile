CORGI = corgi
SRC_DIR = $(shell pwd)/res
OUT_DIR = ./contracts/generated

TEST_SRC_FILES = $(shell find $(SRC_DIR) -name '*.org' | xargs -n1 realpath --relative-to $(SRC_DIR))
TEST_OUT_FILES = $(TEST_SRC_FILES:.org=.sol)

.PHONY: clean

test: dirsetup $(addprefix $(OUT_DIR)/, $(TEST_OUT_FILES))

$(OUT_DIR)/dyn/%.sol : $(SRC_DIR)/dyn/%.org
	$(CORGI) compile $< -o $@ --solidity-lib-path ../../ -c "ABC Research GmbH" 

$(OUT_DIR)/std/%.sol : $(SRC_DIR)/std/%.org
	$(CORGI) compile $< -o $@ --solidity-lib-path ../../ -c "ABC Research GmbH"

clean:
	rm -f $(OUT_DIR)/**/*.sol

dirsetup:
	mkdir -p $(OUT_DIR)/std
	mkdir -p $(OUT_DIR)/dyn